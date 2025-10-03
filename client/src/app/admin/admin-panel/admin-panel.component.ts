import { Component } from '@angular/core';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { UserManagementComponent } from '../user-management/user-management.component';
import { HasRoleDirective } from '../../_directives/has-role.directive';
import { ModuleManagementComponent } from '../module-management/module-management.component';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.css'],
  imports: [
    TabsModule,
    UserManagementComponent,
    HasRoleDirective,
    ModuleManagementComponent
  ]
})
export class AdminPanelComponent { }
