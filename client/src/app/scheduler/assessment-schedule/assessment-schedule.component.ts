import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssessmentSchedule } from '../../_models/assessment-schedule';
import { SchedulerService } from '../../_services/scheduler.service';
import { AccountService } from '../../_services/account.service';
import html2pdf from 'html2pdf.js';

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

  downloadScheduleAsPdf(): void {
    const tableElement = document.getElementById('pdfContent');
    if (!tableElement) return;

    const options = {
      margin: 0.2,
      filename: 'Assessment_Schedule.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' },
      // Use CSS hints without forcing "avoid-all"
      pagebreak: { mode: ['css', 'legacy'] }
    } as any;

    html2pdf().set(options).from(tableElement).save();
  }
}
