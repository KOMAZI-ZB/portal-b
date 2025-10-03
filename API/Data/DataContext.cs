using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using API.Entities;

namespace API.Data
{
    public class DataContext : IdentityDbContext<AppUser, AppRole, int,
        IdentityUserClaim<int>, AppUserRole, IdentityUserLogin<int>,
        IdentityRoleClaim<int>, IdentityUserToken<int>>
    {
        public DataContext(DbContextOptions options) : base(options) { }

        //   Phase 2 Tables
        public DbSet<Module> Modules { get; set; }
        public DbSet<UserModule> UserModules { get; set; }

        //   NEW: Per-venue/day/time sessions for classes
        public DbSet<ClassSession> ClassSessions { get; set; }

        //   Phase 3 Tables
        public DbSet<Document> Documents { get; set; }

        //   Phase 4 Tables
        public DbSet<FaqEntry> FaqEntries { get; set; }

        //   Phase 5 Tables
        public DbSet<Notification> Notifications { get; set; }

        //   NEW: Notification read receipts
        public DbSet<NotificationRead> NotificationReads { get; set; }

        //   Phase 6 Tables
        public DbSet<LabBooking> LabBookings { get; set; }

        //   NEW: External Repository Links
        public DbSet<Repository> Repositories { get; set; }

        //   NEW: Dynamic Assessment Schedule
        public DbSet<Assessment> Assessments { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            //   AppUser ↔ AppUserRole
            builder.Entity<AppUser>(b =>
            {
                b.HasMany(u => u.UserRoles)
                 .WithOne(ur => ur.User)
                 .HasForeignKey(ur => ur.UserId)
                 .IsRequired();

                b.HasMany(u => u.UserModules)
                 .WithOne(um => um.AppUser)
                 .HasForeignKey(um => um.AppUserId)
                 .IsRequired();
            });

            //   AppRole ↔ AppUserRole
            builder.Entity<AppRole>(b =>
            {
                b.HasMany(r => r.UserRoles)
                 .WithOne(ur => ur.Role)
                 .HasForeignKey(ur => ur.RoleId)
                 .IsRequired();
            });

            //   Module ↔ UserModule
            builder.Entity<Module>(b =>
            {
                b.HasMany(m => m.UserModules)
                 .WithOne(um => um.Module)
                 .HasForeignKey(um => um.ModuleId)
                 .IsRequired();

                //   Module ↔ ClassSession
                b.HasMany(m => m.ClassSessions)
                 .WithOne(s => s.Module)
                 .HasForeignKey(s => s.ModuleId)
                 .IsRequired()
                 .OnDelete(DeleteBehavior.Cascade);
            });

            //   Composite Key for UserModule
            builder.Entity<UserModule>()
                .HasKey(um => new { um.AppUserId, um.ModuleId });

            //   Constraints for ClassSession
            builder.Entity<ClassSession>(b =>
            {
                b.Property(s => s.Venue).IsRequired();
                b.Property(s => s.WeekDay).IsRequired();
                b.Property(s => s.StartTime).IsRequired();
                b.Property(s => s.EndTime).IsRequired();

                b.HasIndex(s => new { s.ModuleId, s.Venue, s.WeekDay, s.StartTime, s.EndTime })
                 .IsUnique();
            });

            //   Constraints for FAQ
            builder.Entity<FaqEntry>(b =>
            {
                b.Property(f => f.Question).IsRequired();
                b.Property(f => f.Answer).IsRequired();
                b.Property(f => f.LastUpdated).IsRequired();
            });

            //   Constraints for Notifications
            builder.Entity<Notification>(b =>
            {
                b.Property(a => a.Type).IsRequired();
                b.Property(a => a.Title).IsRequired();
                b.Property(a => a.Message).IsRequired();
                b.Property(a => a.CreatedBy).IsRequired();
                b.Property(a => a.Audience).IsRequired(); // NEW
            });

            //   NotificationRead receipts (unique per user/notification)
            builder.Entity<NotificationRead>(b =>
            {
                b.HasIndex(x => new { x.UserId, x.NotificationId }).IsUnique();
                b.HasOne<Notification>()
                 .WithMany()
                 .HasForeignKey(x => x.NotificationId)
                 .OnDelete(DeleteBehavior.Cascade);
                b.HasOne<AppUser>()
                 .WithMany()
                 .HasForeignKey(x => x.UserId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            //   Constraints for Lab Bookings
            builder.Entity<LabBooking>(b =>
            {
                b.Property(lb => lb.UserName).IsRequired().HasMaxLength(20);
                b.Property(lb => lb.WeekDays).IsRequired().HasMaxLength(20);
                b.Property(lb => lb.BookingDate).IsRequired();
                b.Property(lb => lb.StartTime).IsRequired();
                b.Property(lb => lb.EndTime).IsRequired();
            });

            //   Constraints for Repository Links
            builder.Entity<Repository>(b =>
            {
                b.Property(r => r.Label).IsRequired();
                b.Property(r => r.ImageUrl).IsRequired();
                b.Property(r => r.LinkUrl).IsRequired();
            });

            //   Constraints for Assessments
            builder.Entity<Assessment>(b =>
            {
                b.Property(a => a.Title).IsRequired();
                b.Property(a => a.Date).IsRequired();
                b.Property(a => a.IsTimed).IsRequired();

                b.HasOne(a => a.Module)
                 .WithMany(m => m.Assessments)
                 .HasForeignKey(a => a.ModuleId)
                 .IsRequired()
                 .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
