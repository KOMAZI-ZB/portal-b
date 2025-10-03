import { AfterViewInit, Component, ElementRef, HostListener, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BsModalRef } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-confirm-close-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-close-modal.component.html',
  styleUrls: ['./confirm-close-modal.component.css']
})
export class ConfirmCloseModalComponent implements AfterViewInit {
  @Input() title = 'Leave without saving?';
  @Input() message = 'You have unsaved changes. Do you want to discard them or stay and continue editing?';
  @Input() stayLabel = 'Stay and continue';
  @Input() discardLabel = 'Discard and leave';
  @Input() onStay?: () => void;
  @Input() onDiscard?: () => void;

  private originalHide!: () => void;

  @ViewChild('stayBtn', { static: true }) stayBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('discardBtn', { static: true }) discardBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('firstTrap', { static: true }) firstTrap!: ElementRef<HTMLSpanElement>;
  @ViewChild('lastTrap', { static: true }) lastTrap!: ElementRef<HTMLSpanElement>;

  constructor(public bsModalRef: BsModalRef) { }

  ngAfterViewInit(): void {
    // Default focus on "Stay"
    setTimeout(() => this.stayBtn?.nativeElement.focus(), 0);

    // Monkey-patch hide so backdrop/Esc behave like "Stay"
    this.originalHide = this.bsModalRef.hide.bind(this.bsModalRef);
    this.bsModalRef.hide = () => this.decideStay();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc(ev: KeyboardEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    this.decideStay();
  }

  // Simple focus trap
  onTrapStart() {
    this.discardBtn?.nativeElement.focus();
  }
  onTrapEnd() {
    this.stayBtn?.nativeElement.focus();
  }

  decideStay() {
    try { this.onStay?.(); } finally { this.forceClose(); }
  }

  decideDiscard() {
    try { this.onDiscard?.(); } finally { this.forceClose(); }
  }

  private forceClose() {
    // call real hide (don’t go through patched version)
    this.originalHide();
  }
}
