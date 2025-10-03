import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BsModalRef } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-confirm-delete-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-delete-modal.component.html',
  styleUrls: ['./confirm-delete-modal.component.css']
})
export class ConfirmDeleteModalComponent {
  @Input() title: string = 'Confirm Deletion';
  @Input() message: string = 'Are you sure you want to delete this item?';
  @Input() confirmText: string = 'Delete';
  @Input() cancelText: string = 'No';
  @Input() onConfirm: () => void = () => { };

  constructor(public bsModalRef: BsModalRef) { }

  confirm() {
    this.bsModalRef.hide();
    if (this.onConfirm) this.onConfirm();
  }

  cancel() {
    this.bsModalRef.hide();
  }
}
