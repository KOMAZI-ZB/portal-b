import {
  Component, EventEmitter, Output, Input,
  OnInit, OnChanges, SimpleChanges,
  AfterViewInit, OnDestroy, ElementRef, ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DocumentService } from '../../_services/document.service';
import { ToastrService } from 'ngx-toastr';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { NgIf, NgClass } from '@angular/common';
import { ConfirmCloseModalComponent } from '../confirm-close-modal/confirm-close-modal.component';
import { NotificationService } from '../../_services/notification.service';

@Component({
  selector: 'app-upload-document-modal',
  standalone: true,
  templateUrl: './upload-document-modal.component.html',
  styleUrls: ['./upload-document-modal.component.css'],
  imports: [ReactiveFormsModule, NgIf, NgClass]
})
export class UploadDocumentModalComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() formData!: { source: 'Module' | 'Repository'; moduleId: number | null };
  @Output() onUpload = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  uploadForm: FormGroup;

  private originalHide!: () => void;
  private justSaved = false;

  // backdrop/Esc guards
  private modalEl: HTMLElement | null = null;
  private backdropCapture?: (ev: MouseEvent) => void;
  private escCapture?: (ev: KeyboardEvent) => void;

  // Allowed types (front-end validation)
  private readonly allowedExts = new Set<string>(['.pdf', '.docx', '.ppt', '.xlsx', '.txt']);
  private readonly allowedMimes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain'
  };
  fileTypeError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private documentService: DocumentService,
    private notificationService: NotificationService,
    private toastr: ToastrService,
    public bsModalRef: BsModalRef,
    private bsModalService: BsModalService,
    private elRef: ElementRef<HTMLElement>
  ) {
    this.uploadForm = this.fb.group({
      title: ['', Validators.required],
      file: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.originalHide = this.bsModalRef.hide.bind(this.bsModalRef);
    this.bsModalRef.hide = () => this.attemptClose();
    this.justSaved = false;
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
        if (insideThisModal && !inDialog) {
          if (this.hasUnsavedChanges()) {
            ev.stopPropagation();
            ev.preventDefault();
            this.openConfirm().then(discard => { if (discard) this.originalHide(); });
          }
        }
      };
      modalEl.addEventListener('mousedown', this.backdropCapture, true);
    }

    this.escCapture = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        if (this.hasUnsavedChanges()) {
          ev.stopPropagation();
          ev.preventDefault();
          this.openConfirm().then(discard => { if (discard) this.originalHide(); });
        }
      }
    };
    document.addEventListener('keydown', this.escCapture, true);
  }

  ngOnDestroy(): void {
    if (this.modalEl && this.backdropCapture) {
      this.modalEl.removeEventListener('mousedown', this.backdropCapture, true);
    }
    if (this.escCapture) {
      document.removeEventListener('keydown', this.escCapture, true);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['formData'] && this.formData) {
      if (this.formData.source === 'Module' && (!this.formData.moduleId || this.formData.moduleId <= 0)) {
        this.toastr.error('Upload failed: no module selected.');
        this.originalHide ? this.originalHide() : this.bsModalRef.hide();
      }
    }
  }

  private hasUnsavedChanges(): boolean {
    if (this.justSaved) return false;
    return this.uploadForm.dirty;
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

  private validateSelectedFile(file: File): string | null {
    const name = file.name || '';
    const ext = (name.substring(name.lastIndexOf('.')).toLowerCase()) || '';
    const mime = file.type || '';

    if (!this.allowedExts.has(ext)) {
      return 'Unsupported file type. Allowed: PDF, DOCX, PPT, XLSX, TXT.';
    }

    const expectedMime = this.allowedMimes[ext];
    // Enforce exact MIME match for allow-list (defensive, consistent with API)
    if (mime !== expectedMime) {
      return 'Unsupported file type. Allowed: PDF, DOCX, PPT, XLSX, TXT.';
    }

    return null;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.fileTypeError = null;
      this.uploadForm.get('file')?.setValue(null);
      this.uploadForm.get('file')?.updateValueAndValidity();
      return;
    }

    const error = this.validateSelectedFile(file);
    if (error) {
      // Invalid: clear input, set control error, toast, inline message
      this.fileTypeError = error;
      this.uploadForm.get('file')?.setErrors({ invalidType: true });
      this.uploadForm.get('file')?.markAsTouched();
      this.uploadForm.get('file')?.updateValueAndValidity();
      if (this.fileInput?.nativeElement) {
        this.fileInput.nativeElement.value = '';
      }
      this.toastr.error('Unsupported file type. Allowed: PDF, DOCX, PPT, XLSX, TXT.');
      return;
    }

    // Valid
    this.fileTypeError = null;
    this.uploadForm.get('file')?.setValue(file);
    // preserve required validator; clear invalidType error only
    const currentErrors = this.uploadForm.get('file')?.errors || {};
    delete currentErrors['invalidType'];
    if (Object.keys(currentErrors).length === 0) {
      this.uploadForm.get('file')?.setErrors(null);
    } else {
      this.uploadForm.get('file')?.setErrors(currentErrors);
    }
    this.uploadForm.get('file')?.updateValueAndValidity();
  }

  upload() {
    if (this.uploadForm.invalid) {
      // if specific file error, surface it; else generic required
      if (this.fileTypeError) {
        this.toastr.error(this.fileTypeError);
      } else {
        this.toastr.error('Please fill in all required fields.');
      }
      return;
    }

    const { title, file } = this.uploadForm.value;
    const { source, moduleId } = this.formData;

    if (source === 'Module' && (!moduleId || moduleId <= 0)) {
      this.toastr.error('Upload failed: no module selected.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', file);
    formData.append('source', source);
    if (source === 'Module') formData.append('moduleId', moduleId!.toString());

    const request$ =
      source === 'Module'
        ? this.documentService.uploadModuleDocument(formData)
        : this.documentService.uploadRepositoryDocument(formData);

    request$.subscribe({
      next: () => {
        this.toastr.success('Document uploaded successfully.');
        this.onUpload.emit();
        this.justSaved = true;
        this.uploadForm.markAsPristine();
        this.uploadForm.reset();
        this.originalHide();
      },
      error: (err) => {
        console.error('Upload error:', err);
        // Show specific message if API sent one
        const msg =
          (typeof err?.error === 'string' && err.error) ||
          err?.error?.message ||
          'Upload failed. Please try again.';
        this.toastr.error(msg);
      }
    });
  }
}
