import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../environments/environment';
import { Module } from '../_models/module';
import { AccountService } from '../_services/account.service';

type CoordinatorGroups = { assigned: Module[]; other: Module[] };

@Component({
  selector: 'app-modules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modules.component.html',
  styleUrls: ['./modules.component.css']
})
export class ModulesComponent implements OnInit {
  modules: Module[] = [];               // default (non-coordinator) list
  assignedModules: Module[] = [];       // coordinator view
  otherModules: Module[] = [];          // coordinator view

  selectedSemester = 1;
  roles: string[] = [];
  isCoordinator = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private accountService: AccountService
  ) { }

  ngOnInit(): void {
    this.roles = this.accountService.roles();
    this.isCoordinator = this.roles.includes('Coordinator') && !this.roles.includes('Admin');
    this.loadModules();
  }

  loadModules() {
    if (this.isCoordinator) {
      // ✅ Coordinator grouped endpoint
      this.http
        .get<CoordinatorGroups>(`${environment.apiUrl}modules/semester/${this.selectedSemester}/grouped`)
        .subscribe({
          next: (groups) => {
            this.assignedModules = groups.assigned || [];
            this.otherModules = groups.other || [];
          },
          error: (err) => console.error('Failed to load grouped modules', err)
        });
    } else {
      // original behavior
      this.http
        .get<Module[]>(`${environment.apiUrl}modules/semester/${this.selectedSemester}`)
        .subscribe({
          next: (modules) => (this.modules = modules),
          error: (err) => console.error('Failed to load modules', err)
        });
    }
  }

  onSemesterChange() {
    this.loadModules();
  }

  openModule(module: Module) {
    // ✅ Send both state and query params so the next page can render the header
    // and also survive a refresh (query params).
    this.router.navigate(['/modules', module.id], {
      state: { moduleCode: module.moduleCode, moduleName: module.moduleName },
      queryParams: { code: module.moduleCode, name: module.moduleName }
    });
  }
}
