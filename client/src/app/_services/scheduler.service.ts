import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ClassSchedule } from '../_models/class-schedule';
import { AssessmentSchedule } from '../_models/assessment-schedule';

@Injectable({ providedIn: 'root' })
export class SchedulerService {
  private baseUrl = environment.apiUrl + 'scheduler/';

  constructor(private http: HttpClient) { }

  getClassSchedule(semester: number): Observable<ClassSchedule[]> {
    return this.http.get<ClassSchedule[]>(`${this.baseUrl}class/${semester}`);
  }

  getAssessmentSchedule(semester: number): Observable<AssessmentSchedule[]> {
    return this.http.get<AssessmentSchedule[]>(`${this.baseUrl}assessment/${semester}`);
  }
}
