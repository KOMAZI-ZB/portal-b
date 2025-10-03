using API.Data;
using API.DTOs;
using API.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.RegularExpressions;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController(
    UserManager<AppUser> userManager,
    RoleManager<AppRole> roleManager,
    DataContext context
) : BaseApiController
{
    // ✅ Quick existence check for username/student number (for real-time validation)
    [Authorize(Policy = "RequireAdminRole")]
    [HttpGet("exists/{userName}")]
    public async Task<ActionResult> UsernameExists(string userName)
    {
        var trimmed = userName?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            return Ok(new { exists = false });

        var normalized = trimmed.ToUpperInvariant();
        var exists = await userManager.Users
            .AsNoTracking()
            .AnyAsync(u => u.NormalizedUserName == normalized);

        return Ok(new { exists });
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpPost("register-user")]
    public async Task<ActionResult> RegisterUser(RegisterUserDto dto)
    {
        var userNameTrimmed = dto.UserName?.Trim();
        var emailLower = dto.Email?.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(userNameTrimmed) || string.IsNullOrWhiteSpace(emailLower))
            return BadRequest(new { message = "UserName and Email are required." });

        // 🔒 Enforce 10-digit student number for non-Admin roles (string-based check)
        var isAdminRole = string.Equals(dto.Role, "Admin", StringComparison.OrdinalIgnoreCase);
        if (!isAdminRole)
        {
            if (!Regex.IsMatch(userNameTrimmed, @"^\d{10}$"))
            {
                return BadRequest(new { message = "Username must be exactly 10 digits." });
            }
        }

        var normalizedUserName = userNameTrimmed.ToUpperInvariant();
        var normalizedEmail = emailLower.ToUpperInvariant();

        // Look for an existing user by normalized values
        var existing = await userManager.Users
            .AsNoTracking()
            .Where(x => x.NormalizedUserName == normalizedUserName || x.NormalizedEmail == normalizedEmail)
            .Select(x => new { x.NormalizedUserName, x.NormalizedEmail })
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            var msg = existing.NormalizedUserName == normalizedUserName
                ? $"User already exists with user number '{userNameTrimmed}'."
                : $"User already exists with email '{emailLower}'.";
            return Conflict(new { message = msg }); // 409 for clearer toaster on the client
        }

        // use a transaction so we don't leave a half-created user on failure
        using var tx = await context.Database.BeginTransactionAsync();

        AppUser? user = null;

        try
        {
            user = new AppUser
            {
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                UserName = userNameTrimmed,                               // string, not parsed
                Email = emailLower,
                NormalizedEmail = normalizedEmail,
                NormalizedUserName = normalizedUserName,
                JoinDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };

            var result = await userManager.CreateAsync(user, dto.Password);
            if (!result.Succeeded)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = "Failed to create user", errors = result.Errors });
            }

            if (!await roleManager.RoleExistsAsync(dto.Role))
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = "Invalid role" });
            }

            await userManager.AddToRoleAsync(user, dto.Role);

            // ✅ De-dupe across both semester lists so we never add the same (user,module) twice
            var moduleIds = (dto.Semester1ModuleIds ?? new List<int>())
                .Concat(dto.Semester2ModuleIds ?? new List<int>())
                .Distinct()
                .ToList();

            if (moduleIds.Count > 0)
            {
                var links = moduleIds.Select(id => new UserModule
                {
                    AppUserId = user.Id,
                    ModuleId = id,
                    RoleContext = dto.Role
                });

                context.UserModules.AddRange(links);
            }

            await context.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(new { message = "User registered successfully." });
        }
        catch (DbUpdateException)
        {
            // on any failure after user creation, remove the user to avoid a half-state
            await tx.RollbackAsync();
            if (user != null)
            {
                await userManager.DeleteAsync(user);
            }

            // Most common reason here was duplicate module selection (now prevented by Distinct());
            // still return a safe generic message.
            return BadRequest(new { message = "Failed to register user. Please try again." });
        }
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpGet("users-with-roles")]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetUsersWithRoles()
    {
        var users = await userManager.Users.OrderBy(u => u.UserName).ToListAsync();
        var result = new List<UserDto>();

        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);

            result.Add(new UserDto
            {
                UserName = user.UserName ?? string.Empty,
                Name = user.FirstName,
                Surname = user.LastName,
                Email = user.Email ?? string.Empty,
                Roles = roles.ToArray(),
                Token = "",
                JoinDate = user.JoinDate,
                Modules = new List<ModuleDto>()
            });
        }

        return Ok(result);
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpGet("all-users")]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetAllUsers()
    {
        var users = await context.Users
            .Include(u => u.UserModules)
                .ThenInclude(um => um.Module)
            .ToListAsync();

        var result = new List<UserDto>();

        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);

            result.Add(new UserDto
            {
                UserName = user.UserName ?? string.Empty,
                Name = user.FirstName,
                Surname = user.LastName,
                Email = user.Email ?? string.Empty,
                Roles = roles.ToArray(),
                Token = "",
                JoinDate = user.JoinDate,
                Modules = user.UserModules.Select(um => new ModuleDto
                {
                    Id = um.Module.Id,
                    ModuleCode = um.Module.ModuleCode,
                    ModuleName = um.Module.ModuleName,
                    Semester = um.Module.Semester
                }).ToList()
            });
        }

        return result;
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpGet("users-by-role/{role}")]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetUsersByRole(string role)
    {
        var users = await userManager.GetUsersInRoleAsync(role);
        var result = new List<UserDto>();

        foreach (var user in users)
        {
            await context.Entry(user).Collection(u => u.UserModules).LoadAsync();
            foreach (var um in user.UserModules)
            {
                await context.Entry(um).Reference(um => um.Module).LoadAsync();
            }

            result.Add(new UserDto
            {
                UserName = user.UserName ?? string.Empty,
                Name = user.FirstName,
                Surname = user.LastName,
                Email = user.Email ?? string.Empty,
                Roles = new[] { role },
                Token = "",
                JoinDate = user.JoinDate,
                Modules = user.UserModules.Select(um => new ModuleDto
                {
                    Id = um.Module.Id,
                    ModuleCode = um.Module.ModuleCode,
                    ModuleName = um.Module.ModuleName,
                    Semester = um.Module.Semester
                }).ToList()
            });
        }

        return result;
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpGet("users-with-no-modules")]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetUsersWithNoModules()
    {
        var users = await context.Users
            .Include(u => u.UserModules)
            .Where(u => !u.UserModules.Any())
            .ToListAsync();

        var result = new List<UserDto>();

        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);

            result.Add(new UserDto
            {
                UserName = user.UserName ?? string.Empty,
                Name = user.FirstName,
                Surname = user.LastName,
                Email = user.Email ?? string.Empty,
                Roles = roles.ToArray(),
                Token = "",
                JoinDate = user.JoinDate,
                Modules = new List<ModuleDto>()
            });
        }

        return result;
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpPut("update-modules/{userName}")]
    public async Task<ActionResult> UpdateModules(string userName, UpdateUserModulesDto dto)
    {
        var routeUserName = userName?.Trim();
        if (string.IsNullOrWhiteSpace(routeUserName))
            return BadRequest("UserName is required.");

        var user = await context.Users
            .Include(u => u.UserModules)
            .FirstOrDefaultAsync(u => u.UserName == routeUserName);

        if (user == null) return NotFound("User not found");

        context.UserModules.RemoveRange(user.UserModules);

        var newModuleIds = dto.Semester1ModuleIds.Concat(dto.Semester2ModuleIds).Distinct();
        var roles = await userManager.GetRolesAsync(user);
        var roleContext = roles.FirstOrDefault() ?? "";

        foreach (var moduleId in newModuleIds)
        {
            context.UserModules.Add(new UserModule
            {
                AppUserId = user.Id,
                ModuleId = moduleId,
                RoleContext = roleContext
            });
        }

        await context.SaveChangesAsync();
        return Ok(new { message = "Modules updated successfully" });
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpPut("update-roles/{userName}")]
    public async Task<ActionResult> UpdateRoles(string userName, List<string> roles)
    {
        var routeUserName = userName?.Trim();
        if (string.IsNullOrWhiteSpace(routeUserName))
            return BadRequest("UserName is required.");

        var user = await userManager.FindByNameAsync(routeUserName);
        if (user == null) return NotFound("User not found");

        var currentRoles = await userManager.GetRolesAsync(user);
        await userManager.RemoveFromRolesAsync(user, currentRoles);
        await userManager.AddToRolesAsync(user, roles);

        await context.SaveChangesAsync();
        return Ok(new { message = "Roles updated successfully" });
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpPut("update-user/{userName}")]
    public async Task<ActionResult> UpdateUser(string userName, UpdateUserDto dto)
    {
        var routeUserName = userName?.Trim();
        if (string.IsNullOrWhiteSpace(routeUserName))
            return BadRequest("UserName is required.");

        var user = await userManager.Users.FirstOrDefaultAsync(u => u.UserName == routeUserName);
        if (user == null) return NotFound("User not found");

        user.FirstName = dto.FirstName;
        user.LastName = dto.LastName;

        if (string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest("Email is required.");

        user.Email = dto.Email.ToLower();
        user.NormalizedEmail = dto.Email.ToUpper();
        user.UserName = routeUserName;
        user.NormalizedUserName = routeUserName.ToUpperInvariant();

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return BadRequest(updateResult.Errors);

        if (!string.IsNullOrWhiteSpace(dto.UpdatePassword))
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            var passwordResult = await userManager.ResetPasswordAsync(user, token, dto.UpdatePassword);
            if (!passwordResult.Succeeded)
                return BadRequest(passwordResult.Errors);
        }

        var currentRoles = await userManager.GetRolesAsync(user);
        await userManager.RemoveFromRolesAsync(user, currentRoles);
        await userManager.AddToRolesAsync(user, dto.Roles);

        return Ok(new { message = "User updated successfully." });
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpDelete("delete-user/{userName}")]
    public async Task<ActionResult> DeleteUser(string userName)
    {
        var routeUserName = userName?.Trim();
        if (string.IsNullOrWhiteSpace(routeUserName))
            return BadRequest(new { message = "UserName is required." });

        var user = await userManager.FindByNameAsync(routeUserName);
        if (user == null) return NotFound(new { message = "User not found" });

        context.Users.Remove(user);
        await context.SaveChangesAsync();

        return Ok(new { message = $"User {routeUserName} deleted." });
    }
}
