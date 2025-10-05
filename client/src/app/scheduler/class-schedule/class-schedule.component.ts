import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClassSchedule } from '../../_models/class-schedule';
import { SchedulerService } from '../../_services/scheduler.service';
import { AccountService } from '../../_services/account.service';

// Exact-render screenshot pipeline
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TimeBlock { startTime: string; endTime: string; }
interface CellEntry { moduleCode: string; venue?: string; }

@Component({
  selector: 'app-class-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './class-schedule.component.html',
  styleUrls: ['./class-schedule.component.css']
})
export class ClassScheduleComponent implements OnInit {
  schedules: ClassSchedule[] = [];
  semester = 1;
  weekdays: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  timeBlocks: TimeBlock[] = [];
  blockMap: { [key: string]: CellEntry[] } = {};

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
    const first = pick(u.name);
    const last = pick(u.surname);
    if (first && last) return `${first} ${last}`;
    return first || last || pick(u.displayName, u.username, u.userName);
  }

  loadSchedule(): void {
    this.schedulerService.getClassSchedule(this.semester).subscribe({
      next: (rows) => {
        this.schedules = rows;
        this.generateTimeBlocks();
        this.buildBlockMap();
      },
      error: (err) => console.error(err)
    });
  }

  onSemesterChange(): void { this.loadSchedule(); }

  generateTimeBlocks(): void {
    const seen = new Set<string>();
    const blocks: TimeBlock[] = [];
    for (const s of this.schedules) {
      if (!s.startTime || !s.endTime) continue;
      const key = `${s.startTime}-${s.endTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        blocks.push({ startTime: s.startTime, endTime: s.endTime });
      }
    }
    this.timeBlocks = blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  buildBlockMap(): void {
    this.blockMap = {};
    for (const block of this.timeBlocks) {
      for (const day of this.weekdays) {
        const key = `${block.startTime}-${block.endTime}-${day}`;
        const entries: CellEntry[] = [];
        for (const s of this.schedules) {
          if (s.weekDay?.toLowerCase() !== day.toLowerCase()) continue;
          const isExact = s.startTime === block.startTime && s.endTime === block.endTime;
          if (!isExact) continue;
          if (!entries.some(e => e.moduleCode === s.moduleCode)) {
            entries.push({ moduleCode: s.moduleCode, venue: s.venue });
          }
        }
        this.blockMap[key] = entries;
      }
    }
  }

  getModulesByBlock(block: TimeBlock, day: string): CellEntry[] {
    return this.blockMap[`${block.startTime}-${block.endTime}-${day}`] || [];
  }

  getMaxEntriesForBlock(block: TimeBlock): number {
    return Math.max(
      ...this.weekdays.map(d => this.getModulesByBlock(block, d).length),
      1
    );
  }

  getColorForModule(moduleCode: string): string {
    const colors = [
      '#e3f2fd', '#e8f5e9', '#fff3e0', '#fce4ec',
      '#ede7f6', '#f3e5f5', '#f9fbe7', '#e0f7fa',
      '#ffe0b2', '#c8e6c9', '#d1c4e9', '#b2ebf2'
    ];
    const hash = moduleCode.toUpperCase().split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  /**
   * Pixel-perfect screenshot → PDF (multipage) with:
   * - Page breaks aligned to <tr> boundaries
   * - Uniform margins so content isn't at page edges
   */
  async downloadScheduleAsPdf(): Promise<void> {
    const content = document.getElementById('pdfContent');
    if (!content) return;

    // Collect row top offsets (relative to content) BEFORE rendering canvas
    const contentRect = content.getBoundingClientRect();
    const rowNodes = Array.from(
      content.querySelectorAll<HTMLTableRowElement>('table tbody tr')
    );
    const rowTopsCssPx = rowNodes.map(r => {
      const rTop = r.getBoundingClientRect().top - contentRect.top;
      return Math.max(0, Math.floor(rTop));
    });
    rowTopsCssPx.unshift(0);

    // Render high-DPI canvas of the content
    const SCALE = 2;
    const canvas = await html2canvas(content, {
      scale: SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: content.scrollWidth,
      windowHeight: content.scrollHeight,
      scrollY: -window.scrollY
    });

    // Map row tops from CSS px → canvas px
    const rowTopsCanvasPx = rowTopsCssPx.map(v => Math.round(v * SCALE));

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: 'a4'
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Margins so content isn't glued to edges
    const PAGE_MARGIN_X = 24; // px
    const PAGE_MARGIN_Y = 24; // px
    const usableW = pageW - 2 * PAGE_MARGIN_X;
    const usableH = pageH - 2 * PAGE_MARGIN_Y;

    // Scale to fit usable width
    const imgScale = usableW / canvas.width;
    const canvasPerPage = Math.floor(usableH / imgScale); // canvas px per page vertically

    let rendered = 0;
    const total = canvas.height;

    while (rendered < total) {
      const idealBreak = rendered + canvasPerPage;

      // Snap break to the previous row boundary
      let breakAt = total;
      for (let i = 0; i < rowTopsCanvasPx.length; i++) {
        const y = rowTopsCanvasPx[i];
        if (y > idealBreak) {
          breakAt = Math.max(rendered + 1, rowTopsCanvasPx[i - 1] ?? idealBreak);
          break;
        }
      }
      if (breakAt === total && idealBreak < total) {
        breakAt = idealBreak;
      }

      const sliceH = Math.min(breakAt - rendered, total - rendered);

      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      const sctx = slice.getContext('2d')!;
      sctx.drawImage(
        canvas,
        0, rendered, canvas.width, sliceH,
        0, 0, canvas.width, sliceH
      );

      const data = slice.toDataURL('image/png'); // PNG avoids seam artifacts
      const renderH = sliceH * imgScale;

      pdf.addImage(data, 'PNG', PAGE_MARGIN_X, PAGE_MARGIN_Y, usableW, renderH);

      rendered += sliceH;
      if (rendered < total) pdf.addPage('a4', 'landscape');
    }

    pdf.save('Class_Schedule.pdf');
  }

  formatTime(time: string): string {
    if (!time) return '-';
    const [h, m] = time.split(':');
    return `${h}:${m}`;
  }
}
