import { Component, Input } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { HttpClient } from '@angular/common/http';
import { User } from '../../_models/user';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-delete-user-modal',
  standalone: true,
  templateUrl: './delete-user-modal.component.html',
  styleUrls: ['./delete-user-modal.component.css']
})
export class DeleteUserModalComponent {
  @Input() user!: User;
  @Input() bsModalRef!: BsModalRef<DeleteUserModalComponent>;

  baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    public modalRef: BsModalRef
  ) { }

  confirmDelete() {
    this.http.delete(`${this.baseUrl}admin/delete-user/${this.user.userName}`).subscribe({
      next: (res: any) => {
        this.toastr.success(res?.message || 'User deleted');
        this.modalRef.hide();
      },
      error: err => {
        const msg = err.error?.message || 'Failed to delete user';
        this.toastr.error(msg);
        this.modalRef.hide();
      }
    });
  }

  cancel() {
    this.modalRef.hide();
  }
}
