import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { FaqEntry } from '../_models/faq-entry';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FaqService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  //   GET /faq?pageNumber=1&pageSize=5 (with full response for pagination header)
  getAllFaqs(pageParams: { pageNumber: number; pageSize: number }): Observable<HttpResponse<FaqEntry[]>> {
    const params = new HttpParams()
      .set('pageNumber', pageParams.pageNumber.toString())
      .set('pageSize', pageParams.pageSize.toString());

    return this.http.get<FaqEntry[]>(`${this.baseUrl}faq`, {
      observe: 'response',
      params
    });
  }

  //   POST /faq/create
  createFaq(body: { question: string; answer: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}faq/create`, body);
  }

  //   PUT /faq/update/{id}
  updateFaq(id: number, body: { question: string; answer: string }): Observable<any> {
    return this.http.put(`${this.baseUrl}faq/update/${id}`, body);
  }

  //   DELETE /faq/{id}
  deleteFaq(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}faq/${id}`);
  }
}
