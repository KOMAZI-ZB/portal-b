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

type SortKey = 'userName' | 'name' | 'surname';

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

  // Current sort (cycles on each click). Default preserves existing behaviour (surname).
  sortKey: SortKey = 'surname';

  constructor(
    private adminService: AdminService,
    private modalService: BsModalService
  ) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  private compareStrings(a?: string, b?: string): number {
    return (a || '').localeCompare(b || '', undefined, { sensitivity: 'base' });
  }

  private applySort(list: User[]): User[] {
    const key = this.sortKey;
    return [...list].sort((a, b) => {
      const primary = this.compareStrings((a as any)[key], (b as any)[key]);
      if (primary !== 0) return primary;

      // Deterministic tiebreakers to avoid jitter
      const sA = this.compareStrings(a.surname, b.surname);
      if (sA !== 0) return sA;
      const nA = this.compareStrings(a.name, b.name);
      if (nA !== 0) return nA;
      return this.compareStrings(a.userName, b.userName);
    });
  }

  // Keeps your original default (Surname A→Z) for initial load
  private applyDefaultUserSort(list: User[]): User[] {
    return [...list].sort((a, b) => {
      const sA = this.compareStrings(a.surname, b.surname);
      if (sA !== 0) return sA;
      const nA = this.compareStrings(a.name, b.name);
      if (nA !== 0) return nA;
      return this.compareStrings(a.userName, b.userName);
    });
  }

  loadUsers() {
    this.adminService.getAllUsers().subscribe({
      next: users => {
        const initiallySorted = this.applyDefaultUserSort(users); // Default: Surname A→Z
        this.users = this.applySort(initiallySorted);             // Align with current sortKey
        this.filteredUsers = [...this.users];
      }
    });
  }

  filterUsers(): void {
    const term = (this.searchTerm || '').toLowerCase();
    const list = this.users.filter(user =>
      user.userName.toLowerCase().includes(term) ||
      user.name.toLowerCase().includes(term) ||
      user.surname.toLowerCase().includes(term) ||
      user.roles.some(role => role.toLowerCase().includes(term))
    );
    this.filteredUsers = this.applySort(list); // keep current sort after filtering
  }

  // Click once to cycle: Username → First name → Surname → (repeat)
  cycleSort(): void {
    this.sortKey = this.sortKey === 'surname' ? 'userName'
      : this.sortKey === 'userName' ? 'name'
        : 'surname';
    this.users = this.applySort(this.users);
    this.filteredUsers = this.applySort(this.filteredUsers);
  }

  get sortLabel(): string {
    return this.sortKey === 'userName' ? 'Username'
      : this.sortKey === 'name' ? 'First name'
        : 'Surname';
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
