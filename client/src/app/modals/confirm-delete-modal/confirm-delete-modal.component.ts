import { Component } from '@angular/core';
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
  title: string = 'Confirm Deletion';
  message: string = 'Are you sure you want to delete this notification?';
  onConfirm: () => void = () => { };

  constructor(public bsModalRef: BsModalRef) { }

  confirm() {
    this.bsModalRef.hide();
    if (this.onConfirm) this.onConfirm();
  }

  cancel() {
    this.bsModalRef.hide();
  }
}
