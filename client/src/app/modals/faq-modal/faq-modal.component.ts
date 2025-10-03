import { Component, Input, OnInit, ViewChild, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { FormsModule, NgForm } from '@angular/forms';
import { FaqEntry } from '../../_models/faq-entry';
import { FaqService } from '../../_services/faq.service';
import { ToastrService } from 'ngx-toastr';
import { ConfirmCloseModalComponent } from '../confirm-close-modal/confirm-close-modal.component';

@Component({
  selector: 'app-faq-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './faq-modal.component.html',
  styleUrls: ['./faq-modal.component.css']
})
export class FaqModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() faq?: FaqEntry;

  @ViewChild('faqForm') faqForm?: NgForm;

  question: string = '';
  answer: string = '';

  private originalHide!: () => void;
  private justSaved = false;

  private modalEl: HTMLElement | null = null;
  private backdropCapture?: (ev: MouseEvent) => void;
  private escCapture?: (ev: KeyboardEvent) => void;

  // Validation rules (character-based)
  readonly MIN_CHARS = 5;
  readonly MAX_CHARS = 5000;

  constructor(
    public bsModalRef: BsModalRef<FaqModalComponent>,
    private faqService: FaqService,
    private toastr: ToastrService,
    private bsModalService: BsModalService,
    private elRef: ElementRef<HTMLElement>
  ) { }

  ngOnInit(): void {
    if (this.mode === 'edit' && this.faq) {
      this.question = this.faq.question;
      this.answer = this.faq.answer;
    }
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
    return !!this.faqForm?.dirty;
  }

  private openConfirm(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.bsModalService.show(ConfirmCloseModalComponent, {
        class: 'modal-dialog-centered',
        initialState: { onStay: () => resolve(false), onDiscard: () => resolve(true) }
      });
    });
  }

  // ---- validation helpers (character-based) ----
  private charCount(s: string): number {
    return (s || '').trim().length;
  }

  get questionBlank(): boolean { return this.charCount(this.question) === 0; }
  get answerBlank(): boolean { return this.charCount(this.answer) === 0; }

  get questionTooShort(): boolean {
    const len = this.charCount(this.question);
    return len > 0 && len < this.MIN_CHARS;
  }
  get answerTooShort(): boolean {
    const len = this.charCount(this.answer);
    return len > 0 && len < this.MIN_CHARS;
  }

  get questionTooLong(): boolean { return this.charCount(this.question) > this.MAX_CHARS; }
  get answerTooLong(): boolean { return this.charCount(this.answer) > this.MAX_CHARS; }

  get formInvalid(): boolean {
    return (
      this.questionBlank ||
      this.answerBlank ||
      this.questionTooShort ||
      this.answerTooShort ||
      this.questionTooLong ||
      this.answerTooLong
    );
  }

  async attemptClose() {
    if (this.hasUnsavedChanges()) {
      const discard = await this.openConfirm();
      if (!discard) return;
    }
    this.originalHide();
  }

  submit() {
    if (this.formInvalid) {
      this.toastr.error('Please fix the highlighted errors before submitting.');
      return;
    }

    const faqData = { question: this.question.trim(), answer: this.answer.trim() };

    if (this.mode === 'edit' && this.faq) {
      this.faqService.updateFaq(this.faq.id, faqData).subscribe({
        next: () => { this.toastr.success('FAQ updated successfully.'); this.justSaved = true; this.originalHide(); },
        error: (err) => this.toastr.error(err?.error ?? 'Failed to update FAQ.')
      });
    } else {
      this.faqService.createFaq(faqData).subscribe({
        next: () => { this.toastr.success('FAQ created successfully.'); this.justSaved = true; this.originalHide(); },
        error: (err) => this.toastr.error(err?.error ?? 'Failed to create FAQ.')
      });
    }
  }
}
