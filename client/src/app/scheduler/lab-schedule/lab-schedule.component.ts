import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LabBooking } from '../../_models/labbooking';
import { AccountService } from '../../_services/account.service';
import { LabbookingService } from '../../_services/labbooking.service';
import { BookLabSlotModalComponent } from '../../modals/book-lab-slot-modal/book-lab-slot-modal.component';
import { UnbookLabSlotModalComponent } from '../../modals/unbook-lab-slot-modal/unbook-lab-slot-modal.component';
import html2pdf from 'html2pdf.js';

@Component({
  selector: 'app-lab-schedule',
  templateUrl: './lab-schedule.component.html',
  styleUrl: './lab-schedule.component.css',
  standalone: true,
  imports: [CommonModule, FormsModule, BookLabSlotModalComponent, UnbookLabSlotModalComponent]
})
export class LabScheduleComponent implements OnInit {
  bookings: LabBooking[] = [];
  timeSlots: string[] = [];
  weekdays: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /** Week navigation */
  currentWeekStart: Date = this.startOfWeekSunday(new Date());

  /** Semester filter (1 = Jan–Jun, 2 = Jul–Dec) */
  selectedSemester: 1 | 2 = this.defaultSemesterForDate(new Date());

  /** Modal flags */
  showBookingModal = false;
  showUnbookingModal = false;
  selectedBookingToDelete: LabBooking | null = null;
  modalServerError: string | null = null;   // keep modal open & show error on conflict

  constructor(
    private labbookingService: LabbookingService,
    public accountService: AccountService
  ) { }

  ngOnInit(): void {
    this.generateTimeSlots();
    this.loadBookings();
    // Clamp the initial week to the selected semester
    this.currentWeekStart = this.clampWeekToSemester(this.currentWeekStart, this.selectedSemester, this.currentWeekStart.getFullYear());
  }

  /** User/roles */
  get user() { return this.accountService.currentUser(); }
  get roles(): string[] { return this.accountService.roles(); }
  isStudent(): boolean { return this.roles.includes('Student'); }

  get userFullName(): string {
    const u: any = this.user || {};
    const pick = (...cands: any[]) => cands.map(v => (v ?? '').toString().trim()).find(v => v.length > 0) || '';
    let first = pick(u.name);
    let last = pick(u.surname);
    if (!first || !last) {
      const me = pick(u.userName);
      const mine = this.bookings.find(b => (b.userName ?? '') === me);
      if (mine) {
        if (!first) first = pick(mine.firstName);
        if (!last) last = pick(mine.lastName);
      }
    }
    if (first && last) return `${first} ${last}`;
    return first || last || pick(u.displayName, u.username, u.userName);
  }

  /** Slots (06:10 → 22:10, 1h) */
  generateTimeSlots() {
    const slots: string[] = [];
    const startHour = 6, startMinute = 10, totalSlots = 16;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const fmt = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
    let fromMins = startHour * 60 + startMinute;
    for (let i = 0; i < totalSlots; i++) {
      const toMins = fromMins + 60;
      slots.push(`${fmt(fromMins)} - ${fmt(toMins)}`);
      fromMins += 60;
    }
    this.timeSlots = slots;
  }

  /** Week helpers */
  startOfWeekSunday(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - x.getDay());
    return x;
  }
  addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  /** Semester helpers */
  defaultSemesterForDate(d: Date): 1 | 2 {
    const m = d.getMonth(); // 0-based
    return (m <= 5) ? 1 : 2;
  }
  semesterBounds(sem: 1 | 2, year: number): { start: Date; end: Date } {
    const start = new Date(year, sem === 1 ? 0 : 6, 1);               // Jan 1 or Jul 1
    const end = new Date(year, sem === 1 ? 5 : 11, sem === 1 ? 30 : 31); // Jun 30 or Dec 31
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  clampWeekToSemester(weekStart: Date, sem: 1 | 2, year: number): Date {
    const { start, end } = this.semesterBounds(sem, year);
    let ws = this.startOfWeekSunday(weekStart);
    if (ws < this.startOfWeekSunday(start)) ws = this.startOfWeekSunday(start);
    const lastWeekStart = this.startOfWeekSunday(this.addDays(end, -6)); // ensure Mon–Sat included
    if (ws > lastWeekStart) ws = lastWeekStart;
    return ws;
  }

  /** Semester change */
  onSemesterChange() {
    // Re-clamp week around TODAY for the chosen semester
    const today = new Date();
    const year = today.getFullYear();
    const { start, end } = this.semesterBounds(this.selectedSemester, year);
    const target = (today >= start && today <= end) ? today : start;
    this.currentWeekStart = this.clampWeekToSemester(this.startOfWeekSunday(target), this.selectedSemester, year);
  }

  /** Week nav + state */
  canGoPrevWeek(): boolean {
    const { start } = this.semesterBounds(this.selectedSemester, this.currentWeekStart.getFullYear());
    return this.currentWeekStart > this.startOfWeekSunday(start);
  }
  canGoNextWeek(): boolean {
    const { end } = this.semesterBounds(this.selectedSemester, this.currentWeekStart.getFullYear());
    const lastWeekStart = this.startOfWeekSunday(this.addDays(end, -6));
    return this.currentWeekStart < lastWeekStart;
  }
  prevWeek() {
    if (!this.canGoPrevWeek()) return;
    this.currentWeekStart = this.clampWeekToSemester(this.addDays(this.currentWeekStart, -7), this.selectedSemester, this.currentWeekStart.getFullYear());
  }
  nextWeek() {
    if (!this.canGoNextWeek()) return;
    this.currentWeekStart = this.clampWeekToSemester(this.addDays(this.currentWeekStart, +7), this.selectedSemester, this.currentWeekStart.getFullYear());
  }

  /** View-only if looking at a past week */
  isPastWeekView(): boolean {
    const thisWeek = this.startOfWeekSunday(new Date());
    return this.currentWeekStart < thisWeek;
  }

  /** Labels */
  private fmtDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  getWeekRangeLabelShort(): string {
    const start = new Date(this.currentWeekStart);
    const monday = this.addDays(start, 1);
    const saturday = this.addDays(start, 6);

    const ddMon = monday.getDate();
    const monShort = monday.toLocaleString('default', { month: 'short' });
    const ddSat = saturday.getDate();
    const satShort = saturday.toLocaleString('default', { month: 'short' });
    const year = saturday.getFullYear();

    if (monday.getMonth() === saturday.getMonth() && monday.getFullYear() === saturday.getFullYear()) {
      return `Week: ${ddMon}–${ddSat} ${satShort} ${year}`;
    }
    return `Week: ${ddMon} ${monShort} – ${ddSat} ${satShort} ${year}`;
  }

  /** Booking lookups */
  normalizeApiDateString(s?: string | null): string | null {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : this.fmtDate(d);
  }
  toMinutes(v?: string | null): number | null {
    if (!v) return null;
    const [h, m] = v.slice(0, 5).split(':').map(n => +n);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }
  overlaps(bs: number | null, be: number | null, ss: number, se: number): boolean {
    if (bs == null || be == null) return false;
    return Math.max(bs, ss) < Math.min(be, se);
  }
  sameDay(apiDay?: string | null, gridDay?: string | null): boolean {
    const a = (apiDay ?? '').trim().toLowerCase();
    const b = (gridDay ?? '').trim().toLowerCase();
    return a === b || a.startsWith(b) || b.startsWith(a);
  }

  getBookingDateForDay(day: string): Date {
    const map: Record<string, number> = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
    };
    const key = (day || '').toLowerCase().trim();
    const offset = map[key] ?? 0;
    const d = new Date(this.currentWeekStart);
    d.setDate(this.currentWeekStart.getDate() + offset);
    return d;
  }

  getBookingObject(day: string, slot: string): LabBooking | null {
    const date = this.getBookingDateForDay(day);
    const gridDate = this.fmtDate(date);

    const [sFrom, sTo] = slot.split(' - ');
    const ss = this.toMinutes(sFrom)!;
    const se = this.toMinutes(sTo)!;

    return this.bookings.find(b => {
      // filter to selected semester
      const withinSemester = (() => {
        const { start, end } = this.semesterBounds(this.selectedSemester, date.getFullYear());
        const bd = new Date(this.normalizeApiDateString(b.bookingDate) ?? '');
        return bd >= start && bd <= end;
      })();
      if (!withinSemester) return false;

      const apiDate = this.normalizeApiDateString(b.bookingDate);
      if (!apiDate || apiDate !== gridDate) return false;
      if (!this.sameDay(b.weekDays, day)) return false;

      const bs = this.toMinutes(b.startTime);
      const be = this.toMinutes(b.endTime);
      return this.overlaps(bs, be, ss, se);
    }) || null;
  }

  hasBookingsThisWeek(): boolean {
    const start = new Date(this.currentWeekStart);
    const end = this.addDays(start, 7);
    return this.bookings.some(b => {
      const apiDate = this.normalizeApiDateString(b.bookingDate);
      if (!apiDate) return false;
      const d = new Date(apiDate);
      // also respect semester filter
      const { start: s, end: e } = this.semesterBounds(this.selectedSemester, d.getFullYear());
      const inSemester = d >= s && d <= e;
      return inSemester && d >= start && d < end;
    });
  }

  loadBookings() {
    this.labbookingService.getAllBookings().subscribe({
      next: (res: LabBooking[]) => this.bookings = res || [],
      error: err => { console.error('Failed to load lab bookings', err); this.bookings = []; }
    });
  }

  canBook(): boolean {
    return this.roles.includes('Lecturer') || this.roles.includes('Coordinator') || this.roles.includes('Admin');
  }
  canUnbook(b: LabBooking): boolean {
    // View-only in past weeks: disable unbooking in past week view
    if (this.isPastWeekView()) return false;
    return this.roles.includes('Admin') || b.userName === this.user?.userName;
  }

  /** Modal handlers */
  openBookingModal() {
    if (this.isPastWeekView()) return; // past week is view-only
    this.modalServerError = null;
    this.showBookingModal = true;
  }
  closeBookingModal() { this.showBookingModal = false; }

  triggerUnbookModal(b: LabBooking) {
    if (!this.canUnbook(b)) return;
    this.selectedBookingToDelete = b;
    this.showUnbookingModal = true;
  }
  closeUnbookModal() { this.selectedBookingToDelete = null; this.showUnbookingModal = false; }

  handleBookingConfirmed(data: { day: string; time: string; description?: string }) {
    // Resolve implicit calendar date within the viewed week
    const [sFrom, sTo] = data.time.split(' - ');
    const bookingDateObj = this.getBookingDateForDay(data.day);
    const dto: LabBooking = {
      weekDays: data.day,
      startTime: `${sFrom.slice(0, 5)}:00`,
      endTime: `${sTo.slice(0, 5)}:00`,
      bookingDate: this.fmtDate(bookingDateObj),
      description: (data.description ?? '').slice(0, 25)
    };

    this.modalServerError = null; // clear any prior error
    this.labbookingService.createBooking(dto).subscribe({
      next: () => { this.loadBookings(); this.showBookingModal = false; },
      error: err => {
        // Keep the modal open; show inline server error (no restart)
        const raw = err?.error;
        const message = raw?.message ?? (typeof raw === 'string' ? raw : 'Booking failed. Please adjust your times and try again.');
        this.modalServerError = message;
      }
    });
  }

  handleBookingUnconfirmed() {
    if (!this.selectedBookingToDelete?.id) return;
    this.labbookingService.deleteBooking(this.selectedBookingToDelete.id).subscribe({
      next: () => { this.loadBookings(); this.closeUnbookModal(); },
      error: err => { console.error('Unbooking failed:', err); this.closeUnbookModal(); }
    });
  }

  /** Export */
  downloadScheduleAsPdf() {
    const tableElement = document.getElementById('labScheduleTable');
    if (!tableElement) return;
    const options = {
      margin: 0.5,
      filename: 'Lab_Schedule.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2pdf: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['css', 'avoid-all'] }
    } as any;
    html2pdf().set(options).from(tableElement).save();
  }
}
