import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssessmentSchedule } from '../../_models/assessment-schedule';
import { SchedulerService } from '../../_services/scheduler.service';
import { AccountService } from '../../_services/account.service';

// Exact-render pipeline (same as Class/Lab)
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

@Component({
  selector: 'app-assessment-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assessment-schedule.component.html',
  styleUrls: ['./assessment-schedule.component.css']
})
export class AssessmentScheduleComponent implements OnInit {
  assessments: AssessmentSchedule[] = [];
  groupedAssessments: { [month: string]: AssessmentSchedule[] } = {};
  groupedMonths: string[] = [];
  semester: number = 1;

  constructor(
    private schedulerService: SchedulerService,
    public accountService: AccountService
  ) { }

  ngOnInit(): void { this.loadSchedule(); }

  get user() { return this.accountService.currentUser(); }

  get userFullName(): string {
    const u: any = this.user || {};
    const pick = (...cands: any[]) =>
      cands.map(v => (v ?? '').toString().trim()).find(v => v.length > 0) || '';

    let first = pick(u.name);
    let last = pick(u.surname);

    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (last) return last;

    return pick(u.displayName, u.username, u.userName);
  }

  onSemesterChange(): void { this.loadSchedule(); }

  formatTime(time: string | null | undefined): string {
    if (!time) return '-';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  }

  loadSchedule(): void {
    this.schedulerService.getAssessmentSchedule(this.semester).subscribe({
      next: res => {
        this.assessments = res;
        const groups: { [month: string]: AssessmentSchedule[] } = {};

        for (let a of res) {
          if (!a || !a.date) continue;
          const month = new Date(a.date).toLocaleString('default', {
            month: 'long',
            year: 'numeric'
          });
          if (!groups[month]) groups[month] = [];
          groups[month].push(a);
        }

        for (let month in groups) {
          groups[month] = groups[month].sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA.getTime() !== dateB.getTime()) {
              return dateA.getTime() - dateB.getTime();
            }
            const timeA = a.startTime || a.dueTime || '00:00';
            const timeB = b.startTime || b.dueTime || '00:00';
            return timeA.localeCompare(timeB);
          });
        }

        this.groupedAssessments = groups;
        this.groupedMonths = Object.keys(groups);
      },
      error: err => console.log(err)
    });
  }

  /**
   * Render a DOM node to PDF using html2canvas + jsPDF.
   * - Row-aligned breaks (THEAD + TBODY)
   * - Forbid break between thead and first tbody row
   * - Tiny overlap bleed between slices to ensure visible borders at page edges
   * - Remove trailing empty page if created by rounding
   * - ✅ NEW: append a final boundary at canvas bottom to never drop the last row
   */
  private async renderNodeMultipageToPdf(
    pdf: jsPDF,
    node: HTMLElement,
    _isFirstSection: boolean
  ): Promise<void> {
    // Collect boundaries before rendering canvas
    const rootRect = node.getBoundingClientRect();

    const allTrs = Array.from(
      node.querySelectorAll<HTMLTableRowElement>('table thead tr, table tbody tr')
    );

    // Positions where we must NOT break (first body row top per table)
    const forbiddenBreaksCss = new Set<number>();
    const tables = Array.from(node.querySelectorAll<HTMLTableElement>('table'));
    for (const tbl of tables) {
      const bodyFirst = tbl.querySelector('tbody tr');
      if (bodyFirst) {
        const top = Math.max(0, Math.floor(bodyFirst.getBoundingClientRect().top - rootRect.top));
        forbiddenBreaksCss.add(top);
      }
    }

    let boundariesCss = allTrs
      .map(tr => Math.max(0, Math.floor(tr.getBoundingClientRect().top - rootRect.top)));
    boundariesCss.push(0);
    boundariesCss = Array.from(new Set(boundariesCss)).sort((a, b) => a - b);

    // Render high-DPI canvas
    const SCALE = 2;
    const canvas = await html2canvas(node, {
      scale: SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
      scrollY: -window.scrollY
    });

    const boundaries = boundariesCss.map(v => Math.round(v * SCALE)).sort((a, b) => a - b);

    const forbiddenBreaks = new Set<number>(
      Array.from(forbiddenBreaksCss).map(v => Math.round(v * SCALE))
    );

    // Page metrics
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const PAGE_MARGIN_X = 24;
    const PAGE_MARGIN_Y = 24;
    const usableW = pageW - 2 * PAGE_MARGIN_X;
    const usableH = pageH - 2 * PAGE_MARGIN_Y;

    const scaleToWidth = usableW / canvas.width;
    const canvasPxPerPage = Math.floor(usableH / scaleToWidth);

    // Avoid missing top/bottom borders at cut lines
    const MIN_SLICE_CANVAS = Math.round(24 * SCALE);
    const SLICE_OVERLAP = Math.max(1, Math.round(2 * SCALE)); // ~2 CSS px

    // ✅ Ensure we also have a final boundary at the very bottom of content
    const total = canvas.height;
    if (boundaries[boundaries.length - 1] !== total) {
      boundaries.push(total);
    }

    // Track images put on the current (last) PDF page
    let imagesOnThisPage = 0;

    let rendered = 0;

    while (rendered < total) {
      const ideal = rendered + canvasPxPerPage;

      // Find previous boundary <= ideal
      let idx = 0;
      while (idx < boundaries.length && boundaries[idx] <= ideal) idx++;
      let breakAt = (idx > 0 ? boundaries[idx - 1] : ideal);

      // Don't break between header and first body row
      while (forbiddenBreaks.has(breakAt)) {
        const prevIndex = Math.max(0, boundaries.lastIndexOf(breakAt) - 1);
        const prevVal = boundaries[prevIndex] ?? 0;
        if (prevVal === breakAt) break;
        breakAt = prevVal;
      }

      // Prevent tiny strip
      if (breakAt - rendered < MIN_SLICE_CANVAS && idx > 1) {
        breakAt = boundaries[idx - 2];
      }

      if (breakAt <= rendered && ideal < total) breakAt = Math.min(ideal, total);
      if (breakAt > total) breakAt = total;

      let sliceH = Math.min(breakAt - rendered, total - rendered);
      if (sliceH <= 0) break;

      // Add small overlap (except first slice)
      const srcY = rendered > 0 ? Math.max(0, rendered - SLICE_OVERLAP) : rendered;
      if (rendered > 0) {
        sliceH += Math.min(SLICE_OVERLAP, srcY);
      }

      // Slice
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      const sctx = slice.getContext('2d')!;
      sctx.drawImage(
        canvas,
        0, srcY, canvas.width, sliceH,
        0, 0, canvas.width, sliceH
      );

      const dataUrl = slice.toDataURL('image/png');
      const renderH = sliceH * scaleToWidth;
      pdf.addImage(dataUrl, 'PNG', PAGE_MARGIN_X, PAGE_MARGIN_Y, usableW, renderH);
      imagesOnThisPage++;

      rendered += (breakAt - rendered); // advance to boundary (do NOT include overlap here)

      if (rendered < total) {
        pdf.addPage('a4', 'landscape');
        imagesOnThisPage = 0; // new page starts blank until we add next image
      }
    }

    // If the last page ended up blank (due to rounding), remove it
    if (imagesOnThisPage === 0) {
      const totalPages = pdf.getNumberOfPages();
      if (totalPages > 1) {
        pdf.deletePage(totalPages);
      }
    }
  }

  /**
   * Requirement:
   * - Page 1: logo + name + FIRST month section.
   * - Each subsequent month starts on a NEW page (no logo/topbar).
   * - Row-aligned slicing inside each month; borders preserved.
   */
  async downloadScheduleAsPdf(): Promise<void> {
    const pdfRoot = document.getElementById('pdfContent');
    if (!pdfRoot) return;

    // Elements we need to clone for the first page
    const logoRow = pdfRoot.querySelector<HTMLElement>('.logo-row');
    const topbar = pdfRoot.querySelector<HTMLElement>('.table-topbar');
    const monthSections = Array.from(pdfRoot.querySelectorAll<HTMLElement>('.month-section'));
    if (monthSections.length === 0) return;

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });

    // Helper: create a detached wrapper with copied subtree
    const makeWrapper = (...nodes: HTMLElement[]): HTMLElement => {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-10000px';
      wrapper.style.top = '0';
      wrapper.style.background = '#fff';
      wrapper.style.width = pdfRoot.clientWidth + 'px';
      wrapper.style.padding = '20px';
      wrapper.style.borderRadius = '10px';
      wrapper.id = 'pdf-temp-wrapper';
      for (const n of nodes) wrapper.appendChild(n.cloneNode(true) as HTMLElement);
      document.body.appendChild(wrapper);
      return wrapper;
    };

    // PAGE 1: logo + topbar + first month section
    {
      const firstWrapper = makeWrapper(
        ...(logoRow ? [logoRow] : []),
        ...(topbar ? [topbar] : []),
        monthSections[0]
      );
      await this.renderNodeMultipageToPdf(pdf, firstWrapper, true);
      document.body.removeChild(firstWrapper);
    }

    // Remaining months: each begins on a new page, no logo/topbar
    for (let i = 1; i < monthSections.length; i++) {
      pdf.addPage('a4', 'landscape');
      const wrap = makeWrapper(monthSections[i]);
      await this.renderNodeMultipageToPdf(pdf, wrap, false);
      document.body.removeChild(wrap);
    }

    pdf.save('Assessment_Schedule.pdf');
  }
}
