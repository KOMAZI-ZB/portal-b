import { Component, OnInit, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Module } from '../_models/module';
import { ModuleService } from '../_services/module.service';
import { EditDetailsModalComponent } from '../modals/edit-details-modal/edit-details-modal.component';

@Component({
  selector: 'app-lecturer-panel',
  standalone: true,
  templateUrl: './lecturer-panel.component.html',
  styleUrls: ['./lecturer-panel.component.css'],
  imports: [CommonModule]
})
export class LecturerPanelComponent implements OnInit {
  modules: Module[] = [];
  modalRef?: BsModalRef;

  // Semester filter; 'all' shows everything
  selectedSemesterFilter: number | 'all' = 'all';

  // NEW: filter menu toggle
  isFilterOpen = false;
  @ViewChild('filterMenu', { static: false }) filterMenu?: ElementRef<HTMLElement>;

  constructor(
    private moduleService: ModuleService,
    private modalService: BsModalService
  ) { }

  ngOnInit(): void {
    this.loadAssignedModules();
  }

  loadAssignedModules() {
    this.moduleService.getAssignedModules().subscribe({
      next: modules => this.modules = modules ?? [],
      error: err => console.error('Failed to load assigned modules', err)
    });
  }

  // Filter + sort view (semester order 0 -> 1 -> 2; tie-break by code, then name)
  get viewModules(): Module[] {
    const filter = this.selectedSemesterFilter;

    const filtered = filter === 'all'
      ? this.modules
      : this.modules.filter(m => m?.semester === filter);

    const order = (s: unknown) => (s === 0 ? 0 : s === 1 ? 1 : s === 2 ? 2 : 3);

    return [...filtered].sort((a, b) => {
      const ao = order(a?.semester);
      const bo = order(b?.semester);
      if (ao !== bo) return ao - bo;

      const ac = (a?.moduleCode ?? '').toString();
      const bc = (b?.moduleCode ?? '').toString();
      const cmpCode = ac.localeCompare(bc, undefined, { sensitivity: 'base' });
      if (cmpCode !== 0) return cmpCode;

      const an = (a?.moduleName ?? '').toString();
      const bn = (b?.moduleName ?? '').toString();
      return an.localeCompare(bn, undefined, { sensitivity: 'base' });
    });
  }

  // (legacy) No longer used by the <select>, kept to avoid breaking anything
  onSemesterChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedSemesterFilter = value === 'all' ? 'all' : Number(value);
  }

  // NEW: menu controls
  toggleFilterMenu() {
    this.isFilterOpen = !this.isFilterOpen;
  }

  applyFilter(filter: number | 'all') {
    this.selectedSemesterFilter = filter;
    this.isFilterOpen = false;
  }

  // Close on Esc
  @HostListener('document:keydown.escape')
  onEscape() {
    this.isFilterOpen = false;
  }

  // Close when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isFilterOpen) return;
    const host = this.filterMenu?.nativeElement;
    if (host && event.target instanceof Node && !host.contains(event.target)) {
      this.isFilterOpen = false;
    }
  }

  openEditDetailsModal(module: Module) {
    this.modalRef = this.modalService.show(EditDetailsModalComponent, {
      initialState: { module },
      class: 'modal-lg'
    });
    this.modalRef.onHidden?.subscribe(() => this.loadAssignedModules());
  }
}
