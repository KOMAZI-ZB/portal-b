import { Component, AfterViewInit, ViewChild, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { ConfirmCloseModalComponent } from '../confirm-close-modal/confirm-close-modal.component';

type Assessment = {
  title: string;
  description: string;
  date: string;
  isTimed: boolean;
  startTime?: string | null;
  endTime?: string | null;
  dueTime?: string | null;
  venue?: string | null;
};

type DayState = { checked: boolean; startTime: string; endTime: string };
type VenueConfig = { venue: string; days: { [day: string]: DayState } };

@Component({
  selector: 'app-add-module-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-module-modal.component.html',
  styleUrls: ['./add-module-modal.component.css']
})
export class AddModuleModalComponent implements AfterViewInit, OnDestroy {
  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    public modalRef: BsModalRef,
    private bsModalService: BsModalService,
    private elRef: ElementRef<HTMLElement>
  ) {
    this.originalHide = this.modalRef.hide.bind(this.modalRef);
    this.modalRef.hide = () => this.attemptClose();
  }

  baseUrl = environment.apiUrl;

  @ViewChild('moduleCodeInput') moduleCodeInput!: ElementRef<HTMLInputElement>;
  @ViewChild('detailsForm') detailsForm?: NgForm;

  // Tabs
  activeTab: 'details' | 'contact' | 'assessments' = 'details';
  setTab(tab: 'details' | 'contact' | 'assessments') { this.activeTab = tab; }

  // Details
  moduleCode = '';
  moduleName = '';
  semesterChoice: '1' | '2' | 'year' = '1';

  // Venues & contact sessions (Mon–Fri like Edit Details)
  weekDays: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  venues: VenueConfig[] = [];

  // Assessments
  assessments: Assessment[] = [];

  // Modal housekeeping
  private formDirty = false;
  private originalHide!: () => void;
  private modalEl: HTMLElement | null = null;
  private backdropCapture?: (ev: MouseEvent) => void;
  private escCapture?: (ev: KeyboardEvent) => void;

  // ===== Derived validity =====
  get isDetailsValid(): boolean {
    const code = (this.moduleCode || '').trim();
    const name = (this.moduleName || '').trim();
    const sem = this.semesterChoice;
    return code.length > 0 && name.length > 0 && ['1', '2', 'year'].includes(sem);
  }

  /** Venues optional. If any venue block exists, venue text is required.
   * For each checked day, Start and End are both required. */
  get areVenuesValid(): boolean {
    if (this.venues.length === 0) return true; // optional overall
    for (const v of this.venues) {
      const venueName = (v.venue || '').trim();
      // If user added a block (it exists), venue is required
      if (!venueName) return false;
      for (const day of this.weekDays) {
        const st = v.days[day];
        if (st?.checked) {
          if (!(st.startTime || '').trim()) return false;
          if (!(st.endTime || '').trim()) return false;
        }
      }
    }
    return true;
  }

  /** Assessments optional. If any assessment exists, Title & Description & Date required.
   * If timed => Venue, Start, End required. If not timed => DueTime required. */
  get areAssessmentsValid(): boolean {
    for (const a of this.assessments) {
      if (!a) continue;
      const titleOk = (a.title || '').trim().length > 0;
      const descOk = (a.description || '').trim().length > 0;
      const dateOk = (a.date || '').trim().length > 0;
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

  /** Global form validity for enabling the submit button */
  get isFormValid(): boolean {
    return this.isDetailsValid && this.areVenuesValid && this.areAssessmentsValid;
  }

  // ===== Lifecycle =====
  ngAfterViewInit(): void {
    setTimeout(() => this.moduleCodeInput?.nativeElement.focus(), 0);

    // NOTE: Do NOT auto-add a venue block. Wait for the admin to click "Add Venue".
    const contentEl = this.elRef.nativeElement.closest('.modal-content') as HTMLElement | null;
    const modalEl = contentEl?.closest('.modal') as HTMLElement | null;
    this.modalEl = modalEl;

    if (modalEl) {
      this.backdropCapture = (ev: MouseEvent) => {
        const t = ev.target as Element;
        const inside = t.closest('.modal') === modalEl;
        const inDialog = !!t.closest('.modal-dialog');
        if (inside && !inDialog && this.formDirty) {
          ev.stopPropagation(); ev.preventDefault();
          this.openConfirm().then(discard => { if (discard) this.originalHide(); });
        }
      };
      modalEl.addEventListener('mousedown', this.backdropCapture, true);
    }

    this.escCapture = (ev: KeyboardEvent) => {
      if ((ev.key === 'Escape' || ev.key === 'Esc') && this.formDirty) {
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

  // ===== Mutators / Utils =====
  markDirty(): void { this.formDirty = true; }

  private formatTimeString(time?: string | null): string | null {
    if (!time) return null;
    const t = time.trim();
    if (!t) return null;
    return t.length === 5 ? t + ':00' : t;
  }

  private makeEmptyDays(): { [d: string]: DayState } {
    const obj: { [d: string]: DayState } = {};
    this.weekDays.forEach(d => obj[d] = { checked: false, startTime: '', endTime: '' });
    return obj;
  }

  addVenue(): void {
    this.venues.push({ venue: '', days: this.makeEmptyDays() });
    this.markDirty();
  }

  removeVenue(index: number): void {
    this.venues.splice(index, 1);
    this.markDirty();
  }

  toggleDay(vIndex: number, day: string) {
    const st = this.venues[vIndex].days[day];
    st.checked = !st.checked;
    if (!st.checked) { st.startTime = ''; st.endTime = ''; }
    this.markDirty();
  }

  addAssessment(): void {
    this.assessments.push({
      title: '',
      description: '',
      date: '',
      isTimed: true,
      startTime: '',
      endTime: '',
      venue: ''
    });
    this.markDirty();
  }

  removeAssessment(i: number) {
    this.assessments.splice(i, 1);
    this.markDirty();
  }

  // ===== Submit =====
  private buildClassSessionsFromVenues() {
    const sessions: Array<{ venue: string; weekDay: string; startTime: string; endTime: string }> = [];
    for (const v of this.venues) {
      const venueName = (v.venue || '').trim();
      if (!venueName) continue; // optional overall
      for (const d of this.weekDays) {
        const st = v.days[d];
        if (!st?.checked) continue;
        const start = this.formatTimeString(st.startTime);
        const end = this.formatTimeString(st.endTime);
        if (!start || !end) continue; // inline validation handles messaging
        sessions.push({ venue: venueName, weekDay: d, startTime: start, endTime: end });
      }
    }
    return sessions;
    // NOTE: We no longer send legacy ClassVenue/WeekDays arrays; API accepts ClassSessions (kept contract).
  }

  private buildAssessmentsPayload() {
    return this.assessments.map(a => ({
      title: a.title.trim(),
      description: a.description.trim(),
      date: a.date, // yyyy-MM-dd
      isTimed: a.isTimed,
      startTime: a.isTimed ? this.formatTimeString(a.startTime) : null,
      endTime: a.isTimed ? this.formatTimeString(a.endTime) : null,
      dueTime: a.isTimed ? null : this.formatTimeString(a.dueTime),
      venue: a.isTimed ? (a.venue || '').trim() : null
    }));
  }

  submit(): void {
    // Final guard — show specific toast on failure
    if (!this.isDetailsValid || !this.areVenuesValid || !this.areAssessmentsValid) {
      this.toastr.error('Please fix the highlighted fields.');
      // Jump user to first failing tab for convenience
      if (!this.isDetailsValid) this.activeTab = 'details';
      else if (!this.areVenuesValid) this.activeTab = 'contact';
      else this.activeTab = 'assessments';
      return;
    }

    const isYear = this.semesterChoice === 'year';
    const payload: any = {
      moduleCode: this.moduleCode.trim(),
      moduleName: this.moduleName.trim(),
      semester: isYear ? 0 : Number(this.semesterChoice),
      isYearModule: isYear,
      classSessions: this.buildClassSessionsFromVenues(),
      assessments: this.buildAssessmentsPayload()
    };

    this.http.post(this.baseUrl + 'modules', payload).subscribe({
      next: () => {
        this.toastr.success('Module created successfully.');
        this.formDirty = false;
        this.originalHide();
      },
      error: err => {
        this.toastr.error('Failed to add module');
        console.error(err);
      }
    });
  }

  // ===== Close guards =====
  private openConfirm(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.bsModalService.show(ConfirmCloseModalComponent, {
        class: 'modal-dialog-centered',
        initialState: { onStay: () => resolve(false), onDiscard: () => resolve(true) }
      });
    });
  }

  private attemptClose(): void {
    if (!this.formDirty) {
      this.originalHide();
      return;
    }
    this.openConfirm().then(discard => { if (discard) this.originalHide(); });
  }

  cancel(): void { this.attemptClose(); }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent) {
    if (this.formDirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
