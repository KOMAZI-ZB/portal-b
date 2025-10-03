// src/app/lecturer-panel/lecturer-panel.component.ts
import { Component, OnInit } from '@angular/core';
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

  constructor(
    private moduleService: ModuleService,
    private modalService: BsModalService
  ) { }

  ngOnInit(): void {
    this.loadAssignedModules();
  }

  loadAssignedModules() {
    this.moduleService.getAssignedModules().subscribe({
      next: modules => this.modules = modules,
      error: err => console.error('Failed to load assigned modules', err)
    });
  }

  openEditDetailsModal(module: Module) {
    this.modalRef = this.modalService.show(EditDetailsModalComponent, {
      initialState: { module },
      class: 'modal-lg'
    });
    this.modalRef.onHidden?.subscribe(() => this.loadAssignedModules());
  }
}
