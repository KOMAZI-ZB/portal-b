using System.Text.Json;
using API.DTOs;
using API.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Data;

public class Seed
{
    public static async Task SeedModules(DataContext context)
    {
        if (await context.Modules.AnyAsync()) return;

        var moduleDataPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "SeedData", "ModuleSeedData.json");
        if (!File.Exists(moduleDataPath)) return;

        var moduleData = await File.ReadAllTextAsync(moduleDataPath);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var modules = JsonSerializer.Deserialize<List<Module>>(moduleData, options);

        if (modules is null) return;

        context.Modules.AddRange(modules);
        await context.SaveChangesAsync();
    }

    public static async Task SeedUsers(UserManager<AppUser> userManager, RoleManager<AppRole> roleManager, DataContext context)
    {
        var roles = new List<string> { "Admin", "Student", "Lecturer", "Coordinator" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new AppRole { Name = role });
        }

        if (!await userManager.Users.AnyAsync())
        {
            var userDataPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "SeedData", "UserSeedData.json");
            if (!File.Exists(userDataPath)) return;

            var userData = await File.ReadAllTextAsync(userDataPath);
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var users = JsonSerializer.Deserialize<List<RegisterUserDto>>(userData, options);

            if (users is null) return;

            foreach (var dto in users)
            {
                var userNameTrimmed = dto.UserName?.Trim();
                var emailLower = dto.Email?.Trim().ToLowerInvariant();

                //   Ensure UserName and Email are not null/empty; skip invalid seed rows
                if (string.IsNullOrWhiteSpace(userNameTrimmed) || string.IsNullOrWhiteSpace(emailLower))
                    continue;

                var user = new AppUser
                {
                    FirstName = dto.FirstName,
                    LastName = dto.LastName,
                    UserName = userNameTrimmed,                              //   never null
                    Email = emailLower,
                    NormalizedEmail = emailLower.ToUpperInvariant(),
                    NormalizedUserName = userNameTrimmed.ToUpperInvariant(),
                    JoinDate = dto.JoinDate ?? DateOnly.FromDateTime(DateTime.UtcNow)
                };

                var result = await userManager.CreateAsync(user, dto.Password);
                if (!result.Succeeded) continue;

                await userManager.AddToRoleAsync(user, dto.Role);

                if (!string.Equals(dto.Role, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    var moduleIds = dto.Semester1ModuleIds.Concat(dto.Semester2ModuleIds).Distinct();
                    foreach (var moduleId in moduleIds)
                    {
                        context.UserModules.Add(new UserModule
                        {
                            AppUserId = user.Id,
                            ModuleId = moduleId,
                            RoleContext = dto.Role
                        });
                    }
                }
            }

            await context.SaveChangesAsync();
        }
    }

    public static async Task SeedFaqs(DataContext context)
    {
        if (await context.FaqEntries.AnyAsync()) return;

        var faqDataPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "SeedData", "FaqSeedData.json");
        if (!File.Exists(faqDataPath)) return;

        var faqJson = await File.ReadAllTextAsync(faqDataPath);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var faqs = JsonSerializer.Deserialize<List<FaqEntry>>(faqJson, options);

        if (faqs is null) return;

        foreach (var faq in faqs)
        {
            faq.Answer ??= string.Empty;
        }

        context.FaqEntries.AddRange(faqs);
        await context.SaveChangesAsync();
    }

    public static async Task SeedNotifications(DataContext context)
    {
        if (await context.Notifications.AnyAsync()) return;

        var dataPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "SeedData", "NotificationSeedData.json");
        if (!File.Exists(dataPath)) return;

        var json = await File.ReadAllTextAsync(dataPath);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var notifications = JsonSerializer.Deserialize<List<Notification>>(json, options);

        if (notifications is null) return;

        context.Notifications.AddRange(notifications);
        await context.SaveChangesAsync();
    }

    public static async Task SeedLabBookings(DataContext context)
    {
        if (await context.LabBookings.AnyAsync()) return;

        var path = Path.Combine(Directory.GetCurrentDirectory(), "Data", "SeedData", "LabBookingSeedData.json");
        if (!File.Exists(path)) return;

        var json = await File.ReadAllTextAsync(path);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var bookings = JsonSerializer.Deserialize<List<LabBooking>>(json, options);

        if (bookings is null) return;

        context.LabBookings.AddRange(bookings);
        await context.SaveChangesAsync();
    }

    public static async Task SeedRepositories(DataContext context)
    {
        if (await context.Repositories.AnyAsync()) return;

        var path = Path.Combine(Directory.GetCurrentDirectory(), "Data", "SeedData", "RepositorySeedData.json");
        if (!File.Exists(path)) return;

        var json = await File.ReadAllTextAsync(path);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var repositories = JsonSerializer.Deserialize<List<Repository>>(json, options);

        if (repositories is null) return;

        context.Repositories.AddRange(repositories);
        await context.SaveChangesAsync();
    }

    public static async Task SeedAssessments(DataContext context)
    {
        if (await context.Assessments.AnyAsync()) return;

        var path = Path.Combine(Directory.GetCurrentDirectory(), "Data", "SeedData", "AssessmentSeedData.json");
        if (!File.Exists(path)) return;

        var json = await File.ReadAllTextAsync(path);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var assessments = JsonSerializer.Deserialize<List<Assessment>>(json, options);

        if (assessments is null) return;

        context.Assessments.AddRange(assessments);
        await context.SaveChangesAsync();
    }
}
