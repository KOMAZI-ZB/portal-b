// src/app/modals/delete-module-modal/delete-module-modal.component.ts
import { Component, Input } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { HttpClient } from '@angular/common/http';
import { Module } from '../../_models/module';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-delete-module-modal',
  standalone: true,
  templateUrl: './delete-module-modal.component.html',
  styleUrls: ['./delete-module-modal.component.css']
})
export class DeleteModuleModalComponent {
  @Input() module!: Module;
  @Input() bsModalRef!: BsModalRef<DeleteModuleModalComponent>;

  baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    public modalRef: BsModalRef
  ) { }

  confirmDelete() {
    this.http.delete<{ message: string }>(`${this.baseUrl}modules/${this.module.id}`).subscribe({
      next: (res) => {
        this.toastr.success(res.message || 'Module deleted successfully');
        this.modalRef.hide();
      },
      error: err => {
        this.toastr.error('Failed to delete module');
        console.error(err);
        this.modalRef.hide();
      }
    });
  }

  cancel() {
    this.modalRef.hide();
  }
}
