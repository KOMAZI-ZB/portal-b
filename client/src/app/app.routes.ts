import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { RegisterComponent } from './register/register.component';
import { RepositoryComponent } from './repository/repository.component';
import { FaqComponent } from './faq/faq.component';
import { ClassScheduleComponent } from './scheduler/class-schedule/class-schedule.component';
import { LabScheduleComponent } from './scheduler/lab-schedule/lab-schedule.component';
import { SchedulerComponent } from './scheduler/scheduler/scheduler.component';
import { TestErrorsComponent } from './errors/test-errors/test-errors.component';
import { NotFoundComponent } from './errors/not-found/not-found.component';
import { ServerErrorComponent } from './errors/server-error/server-error.component';

// ✅ Standalone Panels
import { AdminPanelComponent } from './admin/admin-panel/admin-panel.component';
import { LecturerPanelComponent } from './lecturer-panel/lecturer-panel.component';

// ✅ New Module Documents Page
import { ModuleDocumentsComponent } from './module-documents/module-documents.component';

// ✅ Guards
import { authGuard } from './_guards/auth.guard';
import { adminGuard } from './_guards/admin.guard';
import { lecturerGuard } from './_guards/lecturer.guard';
import { nonadminGuard } from './_guards/nonadmin.guard'; // ✅ Unified non-admin guard
import { ModulesComponent } from './modules/modules.component';

// ✅ New Assessment Schedule Component
import { AssessmentScheduleComponent } from './scheduler/assessment-schedule/assessment-schedule.component';
import { NotificationsComponent } from './notifications/notifications.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    {
        path: '',
        runGuardsAndResolvers: 'always',
        canActivate: [authGuard],
        children: [
            { path: 'notifications', component: NotificationsComponent },
            { path: 'repository', component: RepositoryComponent },

            // ✅ Modules tab restricted to non-admins (students, lecturers/coordinators with modules)
            {
                path: 'modules',
                component: ModulesComponent,
                canActivate: [nonadminGuard]
            },
            {
                path: 'modules/:id',
                component: ModuleDocumentsComponent,
                canActivate: [nonadminGuard]
            },

            { path: 'faq', component: FaqComponent },

            // ✅ Scheduler tab restricted to non-admins (students, lecturers/coordinators with modules)
            {
                path: 'scheduler',
                component: SchedulerComponent,
                canActivate: [nonadminGuard],
                children: [
                    { path: 'class', component: ClassScheduleComponent },
                    { path: 'lab', component: LabScheduleComponent },
                    { path: 'assessment', component: AssessmentScheduleComponent },
                    { path: '', redirectTo: 'class', pathMatch: 'full' }
                ]
            },

            // ✅ Admin-only pages
            {
                path: 'register',
                component: RegisterComponent,
                canActivate: [adminGuard]
            },
            {
                path: 'admin',
                component: AdminPanelComponent,
                canActivate: [adminGuard]
            },

            // ✅ Lecturer Panel (only for lecturers/coordinators with modules)
            {
                path: 'lecturer',
                component: LecturerPanelComponent,
                canActivate: [lecturerGuard]
            }
        ]
    },
    { path: 'errors', component: TestErrorsComponent },
    { path: 'not-found', component: NotFoundComponent },
    { path: 'server-error', component: ServerErrorComponent },
    { path: '**', redirectTo: '', pathMatch: 'full' }
];
