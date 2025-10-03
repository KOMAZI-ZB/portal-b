import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LabBooking } from '../../_models/labbooking';

@Component({
  selector: 'app-book-lab-slot-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './book-lab-slot-modal.component.html',
  styleUrls: ['./book-lab-slot-modal.component.css']
})
export class BookLabSlotModalComponent {
  @Input() weekdays: string[] = [];
  @Input() availableTimeSlots: string[] = [];

  /** NEW: inputs to support implicit-date booking + inline overlap pre-check */
  @Input() weekStart!: Date | string;                 // start of viewed week (Sunday)
  @Input() existingBookings: LabBooking[] = [];       // in-memory bookings to pre-check overlap
  @Input() weekLabel?: string;                        // e.g., "Week: 5–11 Oct 2025"
  @Input() serverError: string | null = null;         // server-side error shown inline

  @Output() confirmBooking = new EventEmitter<{ day: string, time: string, description: string }>();
  @Output() cancel = new EventEmitter<void>();

  selectedDay: string = '';
  selectedTime: string = '';
  description: string = '';

  overlapMessage: string | null = null;               // inline validation (no restart)

  /** Map day -> offset from Sunday */
  private dayToOffset(day: string): number {
    const m: Record<string, number> = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
    };
    return m[(day || '').trim().toLowerCase()] ?? 0;
  }

  private asDate(v: Date | string): Date {
    return v instanceof Date ? new Date(v) : new Date(v);
  }

  /** Resolved calendar date inside the currently viewed week (yyyy-MM-dd) */
  get resolvedDateIso(): string | null {
    if (!this.selectedDay) return null;
    const base = this.asDate(this.weekStart);
    const d = new Date(base);
    d.setDate(d.getDate() + this.dayToOffset(this.selectedDay));
    d.setHours(0, 0, 0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  get resolvedDateHuman(): string | null {
    if (!this.resolvedDateIso) return null;
    const d = new Date(this.resolvedDateIso);
    const day = d.toLocaleString('default', { weekday: 'short' });
    const mon = d.toLocaleString('default', { month: 'short' });
    return `${day} ${d.getDate()} ${mon} ${d.getFullYear()}`;
  }

  private toMinutes(hhmm: string | null | undefined): number | null {
    if (!hhmm) return null;
    const s = hhmm.slice(0, 5);
    const [h, m] = s.split(':').map(x => +x);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  private overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
  }

  /** Inline, client-side, friendly overlap pre-check using existingBookings */
  private recomputeOverlapMessage(): void {
    this.overlapMessage = null;
    if (!this.selectedDay || !this.selectedTime || !this.resolvedDateIso) return;

    const [slotFrom, slotTo] = this.selectedTime.split(' - ');
    const ss = this.toMinutes(slotFrom) ?? 0;
    const se = this.toMinutes(slotTo) ?? 0;

    const conflict = this.existingBookings.find(b => {
      if (!b.bookingDate) return false;
      const sameDate = b.bookingDate.slice(0, 10) === this.resolvedDateIso;
      if (!sameDate) return false;
      const bs = this.toMinutes(b.startTime || null);
      const be = this.toMinutes(b.endTime || null);
      if (bs == null || be == null) return false;
      return this.overlaps(ss, se, bs, be);
    });

    if (conflict) {
      this.overlapMessage = `This time overlaps an existing booking on ${this.resolvedDateHuman}. Please adjust your time.`;
    }
  }

  onDayChange() {
    this.serverError = null;          // clear any server error as user edits
    this.recomputeOverlapMessage();
  }

  onTimeChange() {
    this.serverError = null;          // clear any server error as user edits
    this.recomputeOverlapMessage();
  }

  submit() {
    // keep inputs intact; block only when our quick pre-check finds a conflict
    this.recomputeOverlapMessage();
    if (this.overlapMessage) return;

    if (this.selectedDay && this.selectedTime) {
      this.confirmBooking.emit({
        day: this.selectedDay,
        time: this.selectedTime,
        description: this.description.trim()
      });
    }
  }

  close() {
    this.cancel.emit();
  }
}
