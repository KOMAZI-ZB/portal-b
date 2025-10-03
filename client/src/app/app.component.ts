import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavComponent } from "./nav/nav.component";
import { HomeComponent } from "./home/home.component";
import { NgxSpinnerComponent } from 'ngx-spinner';
import { AccountService } from './_services/account.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  imports: [RouterOutlet, NavComponent, NgxSpinnerComponent]
})
export class AppComponent implements OnInit {
  private accountService = inject(AccountService);

  ngOnInit(): void {
    this.setCurrentUserFromStorage();
  }

  private setCurrentUserFromStorage() {
    // Switched to sessionStorage so sessions don’t persist for weeks.
    const userString = sessionStorage.getItem('user');
    if (!userString) return;

    const user = JSON.parse(userString);
    // AccountService will validate exp and auto-logout if needed.
    this.accountService.setCurrentUser(user);
  }
}
