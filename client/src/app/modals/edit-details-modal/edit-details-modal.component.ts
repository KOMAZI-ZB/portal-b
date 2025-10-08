import { Component, Input, OnInit, ViewChild, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { CollapseModule } from 'ngx-bootstrap/collapse';
import { Module } from '../../_models/module';
import { ClassSession } from '../../_models/class-session';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { ConfirmCloseModalComponent } from '../confirm-close-modal/confirm-close-modal.component';

interface Assessment {
  title: string;
  description?: string;
  date: string;
  isTimed: boolean;
  startTime?: string;
  endTime?: string;
  dueTime?: string;
  venue?: string;
}

type DayState = { checked: boolean; startTime: string; endTime: string; };
interface VenueConfig { venue: string; days: { [day: string]: DayState }; }

@Component({
  selector: 'app-edit-details-modal',
  standalone: true,
  templateUrl: './edit-details-modal.component.html',
  styleUrls: ['./edit-details-modal.component.css'],
  imports: [CommonModule, FormsModule, CollapseModule]
})
export class EditDetailsModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() module!: Module;
  @Input() bsModalRef!: BsModalRef<EditDetailsModalComponent>;

  @ViewChild('detailsForm') detailsForm?: NgForm;

  baseUrl = environment.apiUrl;

  weekDays: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  venues: VenueConfig[] = [];
  assessments: Assessment[] = [];

  // UI collapse state
  venueOpen: boolean[] = [];
  assessmentOpen: boolean[] = [];

  activeTab: 'contact' | 'assessments' = 'contact';
  setTab(t: 'contact' | 'assessments') { this.activeTab = t; }

  private originalHide!: () => void;
  private justSaved = false;
  private locallyDirty = false;

  private modalEl: HTMLElement | null = null;
  private backdropCapture?: (ev: MouseEvent) => void;
  private escCapture?: (ev: KeyboardEvent) => void;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    public modalRef: BsModalRef,
    private bsModalService: BsModalService,
    private elRef: ElementRef<HTMLElement>
  ) { }

  ngOnInit(): void {
    const ref = this.bsModalRef ?? this.modalRef;
    this.originalHide = ref.hide.bind(ref);
    ref.hide = () => this.attemptClose();

    this.http.get<Module>(`${this.baseUrl}modules/${this.module.id}`).subscribe({
      next: (updated) => {
        this.module = updated;

        const sessions = (updated.classSessions || []) as ClassSession[];
        const byVenue = new Map<string, VenueConfig>();
        const makeEmptyDays = (): { [d: string]: DayState } => {
          const obj: { [d: string]: DayState } = {};
          this.weekDays.forEach(d => obj[d] = { checked: false, startTime: '', endTime: '' });
          return obj;
        };

        for (const s of sessions) {
          if (!this.weekDays.includes(s.weekDay)) continue;
          if (!byVenue.has(s.venue)) byVenue.set(s.venue, { venue: s.venue, days: makeEmptyDays() });
          const cfg = byVenue.get(s.venue)!;
          if (cfg.days[s.weekDay]) {
            cfg.days[s.weekDay].checked = true;
            cfg.days[s.weekDay].startTime = s.startTime?.length === 5 ? s.startTime + ':00' : (s.startTime || '');
            cfg.days[s.weekDay].endTime = s.endTime?.length === 5 ? s.endTime + ':00' : (s.endTime || '');
          }
        }

        // Do NOT auto-create a venue; only use existing ones
        this.venues = Array.from(byVenue.values());

        this.assessments = (updated.assessments || []).map(a => ({
          title: a.title,
          description: (a as any).description || '',
          date: a.date,
          isTimed: a.isTimed,
          startTime: a.startTime || '',
          endTime: a.endTime || '',
          dueTime: a.dueTime || '',
          venue: a.venue || ''
        }));

        // Start collapsed
        this.venueOpen = this.venues.map(() => false);
        this.assessmentOpen = this.assessments.map(() => false);

        this.justSaved = false;
        this.locallyDirty = false;
        setTimeout(() => this.detailsForm?.form.markAsPristine());
      },
      error: (err) => {
        console.error('❌ Failed to fetch module data:', err);
        this.venues = [];
        this.assessments = [];
        this.venueOpen = [];
        this.assessmentOpen = [];
      }
    });
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

  markDirty() { this.locallyDirty = true; }

  private formatTimeString(time: string): string | null {
    if (!time) return null;
    return time.length === 5 ? time + ':00' : time;
  }

  /** Helper: open and scroll a card into view (venue/assessment). */
  private openAndScroll(kind: 'venue' | 'assessment', index: number) {
    if (kind === 'venue') {
      this.activeTab = 'contact';
      this.venueOpen[index] = true;
    } else {
      this.activeTab = 'assessments';
      this.assessmentOpen[index] = true;
    }
    setTimeout(() => {
      const container = this.elRef.nativeElement.querySelector('.modal-body') as HTMLElement | null;
      const cards = this.elRef.nativeElement.querySelectorAll(kind === 'venue' ? '.venue-card' : '.assessment-card');
      const card = cards[index] as HTMLElement | undefined;
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstInput = card.querySelector('input, textarea, select') as HTMLElement | null;
        if (firstInput) firstInput.focus();
      } else if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    });
  }

  addVenue(): void {
    const days: { [d: string]: DayState } = {};
    this.weekDays.forEach(d => days[d] = { checked: false, startTime: '', endTime: '' });
    this.venues.push({ venue: '', days });
    this.venueOpen.push(true);
    this.markDirty();
    this.openAndScroll('venue', this.venues.length - 1);
  }

  removeVenue(index: number): void {
    this.venues.splice(index, 1);
    this.venueOpen.splice(index, 1);
    this.markDirty();
  }

  toggleVenue(i: number) { this.venueOpen[i] = !this.venueOpen[i]; }

  toggleDay(vIndex: number, day: string): void {
    const state = this.venues[vIndex].days[day];
    state.checked = !state.checked;
    if (!state.checked) { state.startTime = ''; state.endTime = ''; }
    this.markDirty();
  }

  addAssessment() {
    this.assessments.push({ title: '', description: '', date: '', isTimed: true, startTime: '', endTime: '', venue: '' });
    this.assessmentOpen.push(true);
    this.markDirty();
    this.openAndScroll('assessment', this.assessments.length - 1);
  }

  removeAssessment(index: number) {
    this.assessments.splice(index, 1);
    this.assessmentOpen.splice(index, 1);
    this.markDirty();
  }

  toggleAssessment(i: number) { this.assessmentOpen[i] = !this.assessmentOpen[i]; }

  // ===== Semester-aware helpers =====
  private isYearModule(): boolean {
    return !!this.module?.isYearModule || this.module?.semester === 0;
  }

  private isMonthAllowed(month: number): boolean {
    if (this.isYearModule()) return true;
    if (this.module?.semester === 1) return month >= 1 && month <= 6;
    if (this.module?.semester === 2) return month >= 7 && month <= 12;
    return true;
  }

  private isDateAllowedForSemester(dateStr: string): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    const month = d.getMonth() + 1;
    return this.isMonthAllowed(month);
  }

  get dateMin(): string | null {
    const y = new Date().getFullYear();
    if (this.isYearModule()) return `${y}-01-01`;
    return this.module?.semester === 1 ? `${y}-01-01` : `${y}-07-01`;
  }
  get dateMax(): string | null {
    const y = new Date().getFullYear();
    if (this.isYearModule()) return `${y}-12-31`;
    return this.module?.semester === 1 ? `${y}-06-30` : `${y}-12-31`;
  }

  dateViolation(a: Assessment): string | null {
    if (!a.date?.trim()) return null;
    return this.isDateAllowedForSemester(a.date)
      ? null
      : (this.module?.semester === 1
        ? 'For Semester 1, pick a date between Jan 1 and Jun 30.'
        : 'For Semester 2, pick a date between Jul 1 and Dec 31.');
  }

  // ===== Validation parity with Add + semester window =====
  private venuesValid(): boolean {
    if (this.venues.length === 0) return true;
    for (const v of this.venues) {
      const vn = (v.venue || '').trim();
      if (!vn) return false;
      for (const d of this.weekDays) {
        const st = v.days[d];
        if (st?.checked) {
          if (!(st.startTime || '').trim()) return false;
          if (!(st.endTime || '').trim()) return false;
        }
      }
    }
    return true;
  }

  private assessmentsValid(): boolean {
    for (const a of this.assessments) {
      const titleOk = (a.title || '').trim().length > 0;
      const descOk = (a.description || '').trim().length > 0;
      const dateOk = (a.date || '').trim().length > 0 && this.isDateAllowedForSemester(a.date);
      if (!(titleOk && descOk && dateOk)) return false;

      if (a.isTimed) {
        if (!((a.venue || '').trim())) return false;
        if (!((a.startTime || '').trim())) return false;
        if (!((a.endTime || '').trim())) return false;
      } else {
        if (!((a.dueTime || '').trim())) return false;
      }
    }
    return true;
  }

  private hasUnsavedChanges(): boolean {
    if (this.justSaved) return false;
    return !!this.detailsForm?.dirty || this.locallyDirty;
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

  submit() {
    // Validate sections with same rules/messages
    if (!this.venuesValid()) {
      this.activeTab = 'contact';
      this.toastr.error('Please fix the highlighted fields.');
      return;
    }
    if (!this.assessmentsValid()) {
      this.activeTab = 'assessments';
      const bad = this.assessments.find(x => x?.date && !this.isDateAllowedForSemester(x.date));
      if (bad) {
        this.toastr.error(
          this.isYearModule()
            ? 'Please fix the highlighted fields.'
            : (this.module?.semester === 1
              ? 'Semester 1 assessments must be dated between Jan 1 and Jun 30.'
              : 'Semester 2 assessments must be dated between Jul 1 and Dec 31.')
        );
      } else {
        this.toastr.error('Please fix the highlighted fields.');
      }
      return;
    }

    const classSessions: ClassSession[] = [];
    for (const v of this.venues) {
      const venueName = (v.venue || '').trim();
      if (!venueName) continue;
      for (const day of this.weekDays) {
        const st = v.days[day];
        if (!st.checked) continue;
        const start = this.formatTimeString(st.startTime) || '';
        const end = this.formatTimeString(st.endTime) || ''; // ✅ fixed
        if (!start || !end) continue;
        classSessions.push({ venue: venueName, weekDay: day, startTime: start, endTime: end });
      }
    }

    const processedAssessments = this.assessments.map(a => ({
      title: a.title.trim(),
      description: (a.description || '').trim() || null,
      date: a.date,
      isTimed: a.isTimed,
      startTime: a.isTimed ? this.formatTimeString(a.startTime!) : null,
      endTime: a.isTimed ? this.formatTimeString(a.endTime!) : null,
      dueTime: a.isTimed ? null : this.formatTimeString(a.dueTime!),
      venue: a.isTimed ? (a.venue || '').trim() : null
    }));

    const payload: any = { classSessions, assessments: processedAssessments };

    this.http.put<any>(`${this.baseUrl}modules/${this.module.id}`, payload).subscribe({
      next: () => {
        this.toastr.success('Module updated successfully.');
        this.justSaved = true;
        this.originalHide();
      },
      error: err => { this.toastr.error(err?.error ?? 'Failed to update module'); console.error(err); }
    });
  }
}
