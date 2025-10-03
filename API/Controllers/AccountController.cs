using API.DTOs;
using API.Entities;
using API.Extensions;
using API.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AccountController(
    UserManager<AppUser> userManager,
    ITokenService tokenService
) : BaseApiController
{
    [HttpPost("login")]
    public async Task<ActionResult<UserDto>> Login(LoginDto loginDto)
    {
        var errors = new Dictionary<string, string>();

        var inputUserName = loginDto.UserName?.Trim();
        if (string.IsNullOrWhiteSpace(inputUserName))
        {
            errors["userName"] = "User name is required.";
            return Unauthorized(errors);
        }

        var normalized = inputUserName.ToUpperInvariant();

        var user = await userManager.Users
            .Include(u => u.UserModules)
                .ThenInclude(um => um.Module)
            .FirstOrDefaultAsync(u => u.NormalizedUserName == normalized);

        if (user == null)
        {
            errors["userName"] = "User number not found.";
            return Unauthorized(errors);
        }

        var passwordValid = await userManager.CheckPasswordAsync(user, loginDto.Password);
        if (!passwordValid)
        {
            errors["password"] = "Invalid password.";
            return Unauthorized(errors);
        }

        var roles = await userManager.GetRolesAsync(user);

        return new UserDto
        {
            UserName = user.UserName ?? string.Empty, // ✅ guard
            Name = user.FirstName,
            Surname = user.LastName,
            Email = user.Email ?? string.Empty,
            Roles = roles.ToArray(),
            Token = await tokenService.CreateToken(user),
            JoinDate = user.JoinDate, // ✅ include JoinDate for consistency
            Modules = user.UserModules.Select(um => new ModuleDto
            {
                Id = um.Module.Id,
                ModuleCode = um.Module.ModuleCode,
                ModuleName = um.Module.ModuleName,
                Semester = um.Module.Semester
            }).ToList()
        };
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        return Ok(new { message = "Logged out (client must clear token)." });
    }
}
