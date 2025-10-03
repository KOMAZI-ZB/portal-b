import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; //   FormsModule for ngModel
import { User } from '../../_models/user';

import { AddUserModalComponent } from '../../modals/add-user-modal/add-user-modal.component';
import { EditModulesModalComponent } from '../../modals/edit-modules-modal/edit-modules-modal.component';
import { EditUserModalComponent } from '../../modals/edit-user-modal/edit-user-modal.component';
import { DeleteUserModalComponent } from '../../modals/delete-user-modal/delete-user-modal.component';
import { AdminService } from '../../_services/admin.service';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule], //   FormsModule for ngModel
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  searchTerm: string = '';
  modalRef?: BsModalRef;

  constructor(
    private adminService: AdminService,
    private modalService: BsModalService
  ) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  private applyDefaultUserSort(list: User[]): User[] {
    return list.sort((a, b) => {
      const sA = (a.surname || '').localeCompare(b.surname || '', undefined, { sensitivity: 'base' });
      if (sA !== 0) return sA;
      const nA = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      if (nA !== 0) return nA;
      return (a.userName || '').localeCompare(b.userName || '', undefined, { sensitivity: 'base' });
    });
  }

  loadUsers() {
    this.adminService.getAllUsers().subscribe({
      next: users => {
        this.users = this.applyDefaultUserSort(users);                 //   Default: Surname A→Z
        this.filteredUsers = [...this.users];
      }
    });
  }

  filterUsers(): void {
    const term = this.searchTerm.toLowerCase();
    const list = this.users.filter(user =>
      user.userName.toLowerCase().includes(term) ||
      user.name.toLowerCase().includes(term) ||
      user.surname.toLowerCase().includes(term) ||
      user.roles.some(role => role.toLowerCase().includes(term))
    );
    this.filteredUsers = this.applyDefaultUserSort(list);              //   Keep Surname A→Z after filtering
  }

  trackByUserName(index: number, user: User): string {
    return user.userName;
  }

  openAddUserModal() {
    this.modalRef = this.modalService.show(AddUserModalComponent, { class: 'modal-lg' });
    this.modalRef.onHidden?.subscribe(() => this.loadUsers());
  }

  openEditModulesModal(user: User) {
    const matchedUser = this.users.find(u => u.userName === user.userName);
    if (!matchedUser) return;

    this.modalRef = this.modalService.show(EditModulesModalComponent, {
      initialState: { user: matchedUser },
      class: 'modal-lg'
    });
    this.modalRef.onHidden?.subscribe(() => this.loadUsers());
  }

  openEditUserModal(user: User) {
    this.modalRef = this.modalService.show(EditUserModalComponent, {
      initialState: { user }
    });
    this.modalRef.onHidden?.subscribe(() => this.loadUsers());
  }

  openDeleteUserModal(user: User) {
    this.modalRef = this.modalService.show(DeleteUserModalComponent, {
      initialState: { user }
    });
    this.modalRef.onHidden?.subscribe(() => this.loadUsers());
  }
}
