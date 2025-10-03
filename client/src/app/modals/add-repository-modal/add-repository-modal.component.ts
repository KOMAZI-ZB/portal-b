import { Component, EventEmitter, Output, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';
import { RepositoryService } from '../../_services/repository.service';
import { CommonModule } from '@angular/common';
import { Repository } from '../../_models/repository';
import { ConfirmCloseModalComponent } from '../confirm-close-modal/confirm-close-modal.component';

@Component({
  standalone: true,
  selector: 'app-add-repository-modal',
  templateUrl: './add-repository-modal.component.html',
  styleUrls: ['./add-repository-modal.component.css'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class AddRepositoryModalComponent implements AfterViewInit, OnDestroy {
  form: FormGroup;
  imageFile: File | null = null;

  @Output() onAdd = new EventEmitter<void>();

  private originalHide!: () => void;
  private justSaved = false;

  private modalEl: HTMLElement | null = null;
  private backdropCapture?: (ev: MouseEvent) => void;
  private escCapture?: (ev: KeyboardEvent) => void;

  constructor(
    public bsModalRef: BsModalRef,
    private fb: FormBuilder,
    private repoService: RepositoryService,
    private toastr: ToastrService,
    private bsModalService: BsModalService,
    private elRef: ElementRef<HTMLElement>
  ) {
    this.form = this.fb.group({
      label: ['', Validators.required],
      linkUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]]
    });

    this.originalHide = this.bsModalRef.hide.bind(this.bsModalRef);
    this.bsModalRef.hide = () => this.attemptClose();
  }

  ngAfterViewInit(): void {
    const contentEl = this.elRef.nativeElement.closest('.modal-content') as HTMLElement | null;
    const modalEl = contentEl?.closest('.modal') as HTMLElement | null;
    this.modalEl = modalEl;

    if (modalEl) {
      this.backdropCapture = (ev: MouseEvent) => {
        const t = ev.target as Element;
        const inside = t.closest('.modal') === modalEl;
        const inDialog = !!t.closest('.modal-dialog');
        if (inside && !inDialog && this.hasUnsavedChanges()) {
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

  onFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files && fileInput.files.length > 0) this.imageFile = fileInput.files[0];
    else this.imageFile = null;
  }

  submit() {
    if (this.form.invalid) return;

    const repo: Repository = {
      id: 0,
      label: this.form.get('label')?.value,
      linkUrl: this.form.get('linkUrl')?.value,
      image: this.imageFile || undefined
    };

    const useDefault = !this.imageFile;

    this.repoService.addExternalRepository(repo, useDefault).subscribe({
      next: () => {
        this.toastr.success('External repository added successfully.');
        this.onAdd.emit();

        this.justSaved = true;
        this.form.markAsPristine();
        this.originalHide();
      },
      error: () => this.toastr.error('Failed to add external repository.')
    });
  }

  cancel() { this.attemptClose(); }
}
