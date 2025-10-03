// src/app/admin/module-management/module-management.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModuleService } from '../../_services/module.service';
import { Module } from '../../_models/module';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { AddModuleModalComponent } from '../../modals/add-module-modal/add-module-modal.component';
import { DeleteModuleModalComponent } from '../../modals/delete-module-modal/delete-module-modal.component';
import { EditDetailsModalComponent } from '../../modals/edit-details-modal/edit-details-modal.component';
import { EditModuleModalComponent } from '../../modals/edit-module-modal/edit-module-modal.component';

@Component({
  selector: 'app-module-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './module-management.component.html',
  styleUrls: ['./module-management.component.css']
})
export class ModuleManagementComponent implements OnInit {
  modules: Module[] = [];
  filteredModules: Module[] = [];
  searchTerm: string = '';
  modalRef?: BsModalRef;

  constructor(
    private moduleService: ModuleService,
    private modalService: BsModalService
  ) { }

  ngOnInit(): void {
    this.loadModules();
  }

  loadModules(): void {
    this.moduleService.getAllModules().subscribe({
      next: modules => {
        this.modules = modules;
        // Default sort: Year modules (semester 0) first, then 1, then 2; then by module code
        this.filteredModules = this.applyDefaultSort([...modules]);
      }
    });
  }

  filterModules(): void {
    const term = (this.searchTerm || '').trim().toLowerCase();

    // Empty -> show all
    if (term === '') {
      this.filteredModules = this.applyDefaultSort([...this.modules]);
      return;
    }

    // If the query is EXACTLY a semester number, treat it as a strict semester filter
    if (term === '0' || term === '1' || term === '2') {
      const target = Number(term);
      const list = this.modules.filter(m => Number(m.semester) === target);
      this.filteredModules = this.applyDefaultSort(list);
      return;
    }

    // If the query mentions "year", include only year modules (semester 0)
    const isYearQuery = term.includes('year') || term.includes('yr') || term.includes('annual');

    const list = this.modules.filter(mod => {
      const codeMatch = (mod.moduleCode || '').toLowerCase().includes(term);
      const nameMatch = (mod.moduleName || '').toLowerCase().includes(term);
      const semMatch = isYearQuery ? (Number(mod.semester) === 0 || !!mod.isYearModule) : false;
      return codeMatch || nameMatch || semMatch;
    });

    this.filteredModules = this.applyDefaultSort(list);
  }

  openAddModuleModal(): void {
    this.modalRef = this.modalService.show(AddModuleModalComponent, {
      class: 'modal-lg',
      ignoreBackdropClick: true,
      keyboard: false
    });
    this.modalRef.onHidden?.subscribe(() => this.loadModules());
  }

  openEditModuleModal(module: Module): void {
    this.modalRef = this.modalService.show(EditModuleModalComponent, {
      initialState: { module }
    });
    this.modalRef.onHidden?.subscribe(() => this.loadModules());
  }

  openEditDetailsModal(module: Module): void {
    this.modalRef = this.modalService.show(EditDetailsModalComponent, {
      initialState: { module },
      class: 'modal-lg'
    });
    this.modalRef.onHidden?.subscribe(() => this.loadModules());
  }

  openDeleteModuleModal(module: Module): void {
    this.modalRef = this.modalService.show(DeleteModuleModalComponent, {
      initialState: { module }
    });
    this.modalRef.onHidden?.subscribe(() => this.loadModules());
  }

  trackById(index: number, item: Module): number {
    return item.id;
  }

  private applyDefaultSort(list: Module[]): Module[] {
    return list.sort((a: Module, b: Module) => {
      const sa = this.semesterRank(a.semester, a.isYearModule);
      const sb = this.semesterRank(b.semester, b.isYearModule);
      if (sa !== sb) return sa - sb;

      const codeA = (a.moduleCode || '').toString();
      const codeB = (b.moduleCode || '').toString();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  // Rank order: year modules first (0), then semester 1, then semester 2, then everything else.
  private semesterRank(value: any, isYear?: boolean): number {
    if (isYear === true) return 0;

    const n = Number(value);
    if (!isNaN(n)) {
      if (n === 0) return 0;
      if (n === 1) return 1;
      if (n === 2) return 2;
    }

    const vStr = String(value ?? '').toLowerCase().trim();
    if (vStr === '0' || vStr.includes('year')) return 0;
    if (vStr === '1' || vStr.includes('semester 1') || vStr === 'sem 1' || vStr === 's1') return 1;
    if (vStr === '2' || vStr.includes('semester 2') || vStr === 'sem 2' || vStr === 's2') return 2;

    return 99;
  }
}
