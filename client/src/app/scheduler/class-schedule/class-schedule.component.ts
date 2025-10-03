import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClassSchedule } from '../../_models/class-schedule';
import { SchedulerService } from '../../_services/scheduler.service';
import { AccountService } from '../../_services/account.service';
import html2pdf from 'html2pdf.js';

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

  downloadScheduleAsPdf(): void {
    const content = document.getElementById('pdfContent');
    if (!content) return;
    html2pdf().set({
      margin: 0.5,
      filename: 'Class_Schedule.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' },
      // Use CSS hints and legacy handling (no aggressive "avoid-all")
      pagebreak: { mode: ['css', 'legacy'] }
    } as any).from(content).save();
  }

  formatTime(time: string): string {
    if (!time) return '-';
    const [h, m] = time.split(':');
    return `${h}:${m}`;
  }
}
