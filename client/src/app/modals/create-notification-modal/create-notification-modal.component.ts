import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { NotificationService } from '../../_services/notification.service';
import { ToastrService } from 'ngx-toastr';
import { AccountService } from '../../_services/account.service';
import { CommonModule } from '@angular/common';
import { ConfirmCloseModalComponent } from '../confirm-close-modal/confirm-close-modal.component';
import { ModuleService } from '../../_services/module.service';
import { Module } from '../../_models/module';

@Component({
  selector: 'app-create-notification-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-notification-modal.component.html',
  styleUrls: ['./create-notification-modal.component.css']
})
export class CreateNotificationModalComponent implements OnInit, AfterViewInit, OnDestroy {
  form!: FormGroup;
  imageFile?: File;
  currentUserRole: string = '';

  private originalHide!: () => void;
  private justSaved = false;

  private modalEl: HTMLElement | null = null;
  private backdropCapture?: (ev: MouseEvent) => void;
  private escCapture?: (ev: KeyboardEvent) => void;

  audiences = ['All', 'Students', 'Staff', 'ModuleStudents'] as const;
  modules: Module[] = [];

  get isLecturer() { return this.currentUserRole === 'Lecturer'; }
  get isCoordinator() { return this.currentUserRole === 'Coordinator'; }
  get isAdmin() { return this.currentUserRole === 'Admin'; }

  constructor(
    public bsModalRef: BsModalRef<CreateNotificationModalComponent>,
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private toastr: ToastrService,
    private accountService: AccountService,
    private bsModalService: BsModalService,
    private elRef: ElementRef<HTMLElement>,
    private moduleService: ModuleService
  ) { }

  ngOnInit(): void {
    this.currentUserRole = this.accountService.getUserRole();
    this.initForm();

    // Coordinators now see ALL modules (not only assigned). Lecturers still see assigned.
    if (this.isLecturer) {
      this.moduleService.getAssignedModules().subscribe({
        next: (mods) => (this.modules = mods || []),
        error: (e) => console.error('Failed to load assigned modules', e)
      });
    } else if (this.isCoordinator || this.isAdmin) {
      this.moduleService.getAllModules().subscribe({
        next: (mods) => (this.modules = mods || []),
        error: (e) => console.error('Failed to load modules', e)
      });
    }

    this.originalHide = this.bsModalRef.hide.bind(this.bsModalRef);
    this.bsModalRef.hide = () => this.attemptClose();
    this.justSaved = false;

    this.form.get('audience')?.valueChanges.subscribe(() => this.applyModuleRequirement());

    if (this.isLecturer) {
      this.form.get('audience')?.setValue('ModuleStudents', { emitEvent: true });
      this.applyModuleRequirement();
    }
  }

  ngAfterViewInit(): void {
    const contentEl = this.elRef.nativeElement.closest('.modal-content') as HTMLElement | null;
    const modalEl = contentEl?.closest('.modal') as HTMLElement | null;
    this.modalEl = modalEl;

    if (modalEl) {
      this.backdropCapture = (ev: MouseEvent) => {
        const t = ev.target as Element;
        const insideThisModal = t.closest('.modal') === modalEl;
        const inDialog = !!t.closest('.modal-dialog');
        if (insideThisModal && !inDialog && this.hasUnsavedChanges()) {
          ev.stopPropagation(); ev.preventDefault();
          this.openConfirm().then(discard => { if (discard) this.originalHide(); });
        }
      };
      modalEl.addEventListener('mousedown', this.backdropCapture, true);
    }

    this.escCapture = (ev: KeyboardEvent) => {
      if ((ev.key === 'Escape' || ev.key === 'Esc') && this.hasUnsavedChanges()) {
        ev.stopPropagation(); ev.preventDefault();
        this.openConfirm().then(discard => { if (discard) this.originalHide(); });
      }
    };
    document.addEventListener('keydown', this.escCapture, true);
  }

  ngOnDestroy(): void {
    if (this.modalEl && this.backdropCapture) this.modalEl.removeEventListener('mousedown', this.backdropCapture, true);
    if (this.escCapture) document.removeEventListener('keydown', this.escCapture, true);
  }

  private initForm() {
    const defaultAudience = this.isLecturer ? 'ModuleStudents' : 'All';

    this.form = this.fb.group({
      type: ['General', Validators.required],
      title: ['', [Validators.required, Validators.minLength(3)]],
      message: ['', [Validators.required, Validators.minLength(5)]],
      audience: [defaultAudience, Validators.required],
      moduleId: [null],
      image: [null]
    });

    if (this.isLecturer) {
      this.form.get('audience')?.disable({ emitEvent: false });
    }

    this.applyModuleRequirement();
  }

  private applyModuleRequirement() {
    const audience = (this.form.get('audience')?.value || '').toString();
    const moduleCtrl = this.form.get('moduleId');
    const mustSelectModule = this.isLecturer || audience === 'ModuleStudents';

    if (mustSelectModule) moduleCtrl?.setValidators([Validators.required]);
    else moduleCtrl?.clearValidators();

    moduleCtrl?.updateValueAndValidity({ emitEvent: false });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.imageFile = file;
      this.form.markAsDirty();
    }
  }

  private hasUnsavedChanges(): boolean {
    if (this.justSaved) return false;
    return this.form?.dirty || !!this.imageFile;
  }

  private openConfirm(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.bsModalService.show(ConfirmCloseModalComponent, {
        class: 'modal-dialog-centered',
        initialState: { onStay: () => resolve(false), onDiscard: () => resolve(true) }
      });
    });
  }

  async attemptClose() {
    if (this.hasUnsavedChanges()) {
      const discard = await this.openConfirm();
      if (!discard) return;
    }
    this.originalHide();
  }

  submit() {
    if (this.form.invalid) {
      this.toastr.error('Please complete all required fields');
      return;
    }

    const formData = new FormData();

    const audienceValue = this.isLecturer
      ? 'ModuleStudents'
      : (this.form.get('audience')?.value || 'All');

    formData.append('type', this.form.get('type')?.value);
    formData.append('title', this.form.get('title')?.value);
    formData.append('message', this.form.get('message')?.value);
    formData.append('audience', audienceValue);

    const moduleId = this.form.get('moduleId')?.value;
    if (moduleId !== null && moduleId !== undefined && moduleId !== '') {
      formData.append('moduleId', moduleId.toString());
    }

    if (this.imageFile) formData.append('image', this.imageFile);

    this.notificationService.create(formData).subscribe({
      next: () => {
        this.toastr.success('Announcement created successfully.');
        localStorage.setItem('newAnnouncement', 'true');
        this.justSaved = true;
        this.form.markAsPristine();
        this.originalHide();
      },
      error: err => {
        this.toastr.error('Failed to post announcement');
        console.error(err);
      }
    });
  }

  cancel() { this.attemptClose(); }
}
