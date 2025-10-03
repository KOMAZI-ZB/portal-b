import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabBooking } from '../../_models/labbooking';

@Component({
  selector: 'app-unbook-lab-slot-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unbook-lab-slot-modal.component.html',
  styleUrls: ['./unbook-lab-slot-modal.component.css']
})
export class UnbookLabSlotModalComponent {
  @Input() booking!: LabBooking; // ✅ Accept a single booking
  @Output() confirmUnbooking = new EventEmitter<void>(); // ✅ No ID needed
  @Output() cancel = new EventEmitter<void>();

  submit() {
    this.confirmUnbooking.emit(); // ID sent via parent context
  }

  close() {
    this.cancel.emit();
  }
}
