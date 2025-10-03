import { Component, Input, OnInit, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { User } from '../../_models/user';
import { ModuleService } from '../../_services/module.service';
import { AdminService } from '../../_services/admin.service';
import { Module } from '../../_models/module';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmCloseModalComponent } from '../confirm-close-modal/confirm-close-modal.component';

@Component({
  selector: 'app-edit-modules-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-modules-modal.component.html',
  styleUrls: ['./edit-modules-modal.component.css']
})
export class EditModulesModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() user!: User;
  @Input() bsModalRef!: BsModalRef<EditModulesModalComponent>;

  private allModules: Module[] = [];
  semester1Modules: Module[] = [];
  semester2Modules: Module[] = [];

  selectedSemester1: number[] = [];
  selectedSemester2: number[] = [];

  private originalHide!: () => void;
  private justSaved = false;
  private locallyDirty = false;

  private modalEl: HTMLElement | null = null;
  private backdropCapture?: (ev: MouseEvent) => void;
  private escCapture?: (ev: KeyboardEvent) => void;

  // Year module support (no labels shown in UI)
  private readonly yearModuleCodes = new Set<string>(['CSIS6809', 'BCIS6809']);
  isYear(m: Module): boolean {
    const code = (m.moduleCode || '').toUpperCase();
    return (m as any).isYearModule === true || m.semester === 0 || this.yearModuleCodes.has(code);
  }

  // (Getter retained but no longer used to block UI)
  get isAdmin(): boolean {
    const u: any = this.user || {};
    const roles: string[] = Array.isArray(u.roles) ? u.roles : [];
    return u.role === 'Admin' || roles.includes('Admin');
  }

  constructor(
    private moduleService: ModuleService,
    private adminService: AdminService,
    private toastr: ToastrService,
    public modalRef: BsModalRef,
    private bsModalService: BsModalService,
    private elRef: ElementRef<HTMLElement>
  ) { }

  private sortByCode(a: Module, b: Module) {
    return (a.moduleCode || '').localeCompare(b.moduleCode || '', undefined, { numeric: true, sensitivity: 'base' });
  }

  ngOnInit(): void {
    const ref = this.bsModalRef ?? this.modalRef;
    this.originalHide = ref.hide.bind(ref);
    ref.hide = () => this.attemptClose();

    // ✅ Admins are now allowed — don't block loading anymore
    this.moduleService.getAllModules().subscribe({
      next: modules => {
        this.allModules = modules;
        this.rebuildSemesterLists();

        const selectedIds = this.user.modules.map(m => m.id);
        this.selectedSemester1 = this.semester1Modules.filter(m => selectedIds.includes(m.id)).map(m => m.id);
        this.selectedSemester2 = this.semester2Modules.filter(m => selectedIds.includes(m.id)).map(m => m.id);

        this.locallyDirty = false;
      },
      error: () => this.toastr.error('Failed to load modules')
    });
  }

  private rebuildSemesterLists(): void {
    this.semester1Modules = this.allModules
      .filter(m => m.semester === 1 || this.isYear(m))
      .sort(this.sortByCode.bind(this));

    this.semester2Modules = this.allModules
      .filter(m => m.semester === 2 || this.isYear(m))
      .sort(this.sortByCode.bind(this));
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

  private hasUnsavedChanges(): boolean {
    if (this.justSaved) return false;
    return this.locallyDirty;
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

  toggleModule(id: number, list: number[], event: any) {
    if (event.target.checked) {
      if (!list.includes(id)) list.push(id);
    } else {
      const index = list.indexOf(id);
      if (index > -1) list.splice(index, 1);
    }
    this.locallyDirty = true;
  }

  submit() {
    this.adminService.updateUserModules(this.user.userName, this.selectedSemester1, this.selectedSemester2)
      .subscribe({
        next: () => { this.toastr.success('Modules updated successfully'); this.justSaved = true; this.originalHide(); },
        error: err => { const message = err.error?.message || 'Failed to update modules'; this.toastr.error(message); }
      });
  }

  cancel() { this.attemptClose(); }

  trackById(index: number, item: Module): number { return item.id; }
}
