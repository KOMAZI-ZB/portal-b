using API.DTOs;
using API.Entities;
using API.Data;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq; // (existing)
using System;      // (existing)

namespace API.Controllers;

[Authorize]
public class ModulesController(DataContext context) : BaseApiController
{
    [Authorize(Policy = "RequireAdminRole")]
    [HttpPost]
    public async Task<ActionResult> AddModule(ModuleDto dto)
    {
        // Normalize: any year module => Semester = 0
        var isYear = dto.IsYearModule || dto.Semester == 0;
        var semester = isYear ? 0 : dto.Semester;

        var module = new Module
        {
            ModuleCode = dto.ModuleCode,
            ModuleName = dto.ModuleName,
            Semester = semester,
            IsYearModule = isYear,

            // legacy fields optional/ignored for schedule rendering
            ClassVenue = dto.ClassVenue,
            WeekDays = dto.WeekDays != null ? string.Join(",", dto.WeekDays) : null,
            StartTimes = dto.StartTimes != null ? string.Join(",", dto.StartTimes) : null,
            EndTimes = dto.EndTimes != null ? string.Join(",", dto.EndTimes) : null
        };

        // Persist per-venue sessions
        if (dto.ClassSessions != null)
        {
            foreach (var s in dto.ClassSessions)
            {
                module.ClassSessions.Add(new ClassSession
                {
                    Venue = s.Venue,
                    WeekDay = s.WeekDay,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime
                });
            }
        }

        // Persist assessments (NOW includes Description)
        if (dto.Assessments != null)
        {
            foreach (var a in dto.Assessments)
            {
                module.Assessments.Add(new Assessment
                {
                    Title = a.Title,
                    Description = a.Description,          // save description
                    Date = DateOnly.Parse(a.Date),
                    StartTime = a.StartTime,
                    EndTime = a.EndTime,
                    DueTime = a.DueTime,
                    Venue = a.Venue,
                    IsTimed = a.IsTimed
                });
            }
        }

        context.Modules.Add(module);
        await context.SaveChangesAsync();

        return Ok(new { message = "Module created successfully.", moduleId = module.Id });
    }

    // allow Admin OR Coordinator to fetch all modules
    [Authorize(Roles = "Admin,Coordinator")]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ModuleDto>>> GetAllModules()
    {
        var modules = await context.Modules
            .Include(m => m.ClassSessions)
            .ToListAsync();

        var result = modules.Select(m => new ModuleDto
        {
            Id = m.Id,
            ModuleCode = m.ModuleCode,
            ModuleName = m.ModuleName,
            Semester = m.Semester,
            IsYearModule = m.IsYearModule,
            ClassVenue = m.ClassVenue,
            WeekDays = m.WeekDays?.Split(',') ?? [],
            StartTimes = m.StartTimes?.Split(',') ?? [],
            EndTimes = m.EndTimes?.Split(',') ?? [],
            ClassSessions = m.ClassSessions.Select(s => new ClassSessionDto
            {
                Id = s.Id,
                Venue = s.Venue,
                WeekDay = s.WeekDay,
                StartTime = s.StartTime,
                EndTime = s.EndTime
            }).ToList()
        }).ToList();

        return Ok(result);
    }

    [Authorize]
    [HttpGet("semester/{semester}")]
    public async Task<ActionResult<IEnumerable<ModuleDto>>> GetModulesBySemester(int semester)
    {
        var userId = int.Parse(User.GetUserId());

        if (User.IsInRole("Admin"))
        {
            var allModules = await context.Modules
                .Where(m => m.Semester == semester || m.IsYearModule || m.Semester == 0) // include year modules (sem 0)
                .Include(m => m.ClassSessions)
                .ToListAsync();

            return Ok(allModules.Select(m => new ModuleDto
            {
                Id = m.Id,
                ModuleCode = m.ModuleCode,
                ModuleName = m.ModuleName,
                Semester = m.Semester,
                IsYearModule = m.IsYearModule,
                ClassVenue = m.ClassVenue,
                WeekDays = m.WeekDays?.Split(',') ?? [],
                StartTimes = m.StartTimes?.Split(',') ?? [],
                EndTimes = m.EndTimes?.Split(',') ?? [],
                ClassSessions = m.ClassSessions.Select(s => new ClassSessionDto
                {
                    Id = s.Id,
                    Venue = s.Venue,
                    WeekDay = s.WeekDay,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime
                }).ToList()
            }).ToList());
        }

        var assignedModules = await context.UserModules
            .Where(um => um.AppUserId == userId &&
                         (um.Module.Semester == semester || um.Module.IsYearModule || um.Module.Semester == 0)) // include year modules (sem 0)
            .Include(um => um.Module)
                .ThenInclude(m => m.ClassSessions)
            .Select(um => um.Module)
            .ToListAsync();

        return Ok(assignedModules.Select(m => new ModuleDto
        {
            Id = m.Id,
            ModuleCode = m.ModuleCode,
            ModuleName = m.ModuleName,
            Semester = m.Semester,
            IsYearModule = m.IsYearModule,
            ClassVenue = m.ClassVenue,
            WeekDays = m.WeekDays?.Split(',') ?? [],
            StartTimes = m.StartTimes?.Split(',') ?? [],
            EndTimes = m.EndTimes?.Split(',') ?? [],
            ClassSessions = m.ClassSessions.Select(s => new ClassSessionDto
            {
                Id = s.Id,
                Venue = s.Venue,
                WeekDay = s.WeekDay,
                StartTime = s.StartTime,
                EndTime = s.EndTime
            }).ToList()
        }).ToList());
    }

    // Coordinator grouped view (assigned vs other)
    [Authorize(Roles = "Coordinator")]
    [HttpGet("semester/{semester}/grouped")]
    public async Task<ActionResult> GetCoordinatorModulesGrouped(int semester)
    {
        var userId = int.Parse(User.GetUserId());

        // All modules in this semester or year modules (sem 0)
        var allModules = await context.Modules
            .Where(m => m.Semester == semester || m.IsYearModule || m.Semester == 0)
            .Include(m => m.ClassSessions)
            .ToListAsync();

        // Modules where this user is linked as Coordinator
        var managedIds = await context.UserModules
            .Where(um => um.AppUserId == userId
                         && (um.Module.Semester == semester || um.Module.IsYearModule || um.Module.Semester == 0)
                         && um.RoleContext == "Coordinator")
            .Select(um => um.ModuleId)
            .ToListAsync();

        var assigned = allModules
            .Where(m => managedIds.Contains(m.Id))
            .Select(m => new ModuleDto
            {
                Id = m.Id,
                ModuleCode = m.ModuleCode,
                ModuleName = m.ModuleName,
                Semester = m.Semester,
                IsYearModule = m.IsYearModule,
                ClassVenue = m.ClassVenue,
                WeekDays = m.WeekDays?.Split(',') ?? [],
                StartTimes = m.StartTimes?.Split(',') ?? [],
                EndTimes = m.EndTimes?.Split(',') ?? [],
                ClassSessions = m.ClassSessions.Select(s => new ClassSessionDto
                {
                    Id = s.Id,
                    Venue = s.Venue,
                    WeekDay = s.WeekDay,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime
                }).ToList()
            })
            .ToList();

        var other = allModules
            .Where(m => !managedIds.Contains(m.Id))
            .Select(m => new ModuleDto
            {
                Id = m.Id,
                ModuleCode = m.ModuleCode,
                ModuleName = m.ModuleName,
                Semester = m.Semester,
                IsYearModule = m.IsYearModule,
                ClassVenue = m.ClassVenue,
                WeekDays = m.WeekDays?.Split(',') ?? [],
                StartTimes = m.StartTimes?.Split(',') ?? [],
                EndTimes = m.EndTimes?.Split(',') ?? [],
                ClassSessions = m.ClassSessions.Select(s => new ClassSessionDto
                {
                    Id = s.Id,
                    Venue = s.Venue,
                    WeekDay = s.WeekDay,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime
                }).ToList()
            })
            .ToList();

        return Ok(new { assigned, other });
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteModule(int id)
    {
        var module = await context.Modules.FindAsync(id);
        if (module == null) return NotFound("Module not found.");

        var userLinks = await context.UserModules.Where(x => x.ModuleId == id).ToListAsync();
        var docs = await context.Documents.Where(x => x.ModuleId == id).ToListAsync();
        var notifications = await context.Notifications.Where(x => x.ModuleId == id).ToListAsync();
        var assessments = await context.Assessments.Where(x => x.ModuleId == id).ToListAsync();
        var sessions = await context.ClassSessions.Where(x => x.ModuleId == id).ToListAsync();

        context.UserModules.RemoveRange(userLinks);
        context.Documents.RemoveRange(docs);
        context.Notifications.RemoveRange(notifications);
        context.Assessments.RemoveRange(assessments);
        context.ClassSessions.RemoveRange(sessions);
        context.Modules.Remove(module);

        await context.SaveChangesAsync();
        return Ok(new { message = "Module deleted." });
    }

    [Authorize(Roles = "Admin,Lecturer,Coordinator")]
    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateModule(int id, UpdateModuleDto dto)
    {
        var module = await context.Modules
            .Include(m => m.ClassSessions)
            .FirstOrDefaultAsync(m => m.Id == id);

        if (module == null) return NotFound(new { message = "Module not found." });

        // Capture originals for comparison
        var originalCode = module.ModuleCode ?? string.Empty;
        var originalName = module.ModuleName ?? string.Empty;

        // class sessions (snapshot before replacement)
        var originalSessions = module.ClassSessions
            .Select(s => new { s.Venue, s.WeekDay, s.StartTime, s.EndTime })
            .OrderBy(x => x.Venue).ThenBy(x => x.WeekDay).ThenBy(x => x.StartTime).ThenBy(x => x.EndTime)
            .ToList();

        // assessments (min fields to compare)
        var originalAssessments = await context.Assessments
            .Where(a => a.ModuleId == id)
            .Select(a => new
            {
                a.Title,
                a.Description,
                a.Date,
                a.StartTime,
                a.EndTime,
                a.DueTime,
                a.Venue,
                a.IsTimed
            })
            .OrderBy(a => a.Date).ThenBy(a => a.Title)
            .ToListAsync();

        // Apply basic fields (metadata)
        if (dto.ModuleCode is not null) module.ModuleCode = dto.ModuleCode;
        if (dto.ModuleName is not null) module.ModuleName = dto.ModuleName;

        // Handle year / semester normalization
        if (dto.IsYearModule.HasValue)
        {
            module.IsYearModule = dto.IsYearModule.Value;
            if (module.IsYearModule) module.Semester = 0;
        }

        if (dto.Semester != 0 && !module.IsYearModule)
        {
            module.Semester = dto.Semester;
        }

        // legacy fields (kept writable)
        module.ClassVenue = dto.ClassVenue;
        module.WeekDays = dto.WeekDays != null ? string.Join(",", dto.WeekDays) : null;
        module.StartTimes = dto.StartTimes != null ? string.Join(",", dto.StartTimes) : null;
        module.EndTimes = dto.EndTimes != null ? string.Join(",", dto.EndTimes) : null;

        // replace sessions
        var existing = await context.ClassSessions.Where(s => s.ModuleId == id).ToListAsync();
        context.ClassSessions.RemoveRange(existing);

        if (dto.ClassSessions != null)
        {
            foreach (var s in dto.ClassSessions)
            {
                context.ClassSessions.Add(new ClassSession
                {
                    ModuleId = id,
                    Venue = s.Venue,
                    WeekDay = s.WeekDay,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime
                });
            }
        }

        // replace assessments (NOW includes Description)
        var existingAssessments = await context.Assessments.Where(a => a.ModuleId == id).ToListAsync();
        context.Assessments.RemoveRange(existingAssessments);

        if (dto.Assessments != null)
        {
            foreach (var a in dto.Assessments)
            {
                context.Assessments.Add(new Assessment
                {
                    Title = a.Title,
                    Description = a.Description,          // save description
                    Date = DateOnly.Parse(a.Date),
                    StartTime = a.StartTime,
                    EndTime = a.EndTime,
                    DueTime = a.DueTime,
                    Venue = a.Venue,
                    IsTimed = a.IsTimed,
                    ModuleId = id
                });
            }
        }

        // Persist updates to compare against DB state
        await context.SaveChangesAsync();

        // Compare sessions for CLASS schedule notification
        var currentSessions = await context.ClassSessions.Where(s => s.ModuleId == id)
            .Select(s => new { s.Venue, s.WeekDay, s.StartTime, s.EndTime })
            .OrderBy(x => x.Venue).ThenBy(x => x.WeekDay).ThenBy(x => x.StartTime).ThenBy(x => x.EndTime)
            .ToListAsync();

        bool classScheduleChanged = originalSessions.Count != currentSessions.Count
            || originalSessions.Zip(currentSessions, (o, c) =>
                o.Venue != c.Venue || o.WeekDay != c.WeekDay || o.StartTime != c.StartTime || o.EndTime != c.EndTime)
               .Any(diff => diff);

        // Compare assessments for ASSESSMENT schedule notification
        var currentAssessments = await context.Assessments
            .Where(a => a.ModuleId == id)
            .Select(a => new
            {
                a.Title,
                a.Description,
                a.Date,
                a.StartTime,
                a.EndTime,
                a.DueTime,
                a.Venue,
                a.IsTimed
            })
            .OrderBy(a => a.Date).ThenBy(a => a.Title)
            .ToListAsync();

        bool assessmentScheduleChanged =
            originalAssessments.Count != currentAssessments.Count
            || originalAssessments.Zip(currentAssessments, (o, c) =>
                   o.Title != c.Title ||
                   o.Description != c.Description ||
                   o.Date != c.Date ||
                   o.StartTime != c.StartTime ||
                   o.EndTime != c.EndTime ||
                   o.DueTime != c.DueTime ||
                   o.Venue != c.Venue ||
                   o.IsTimed != c.IsTimed)
               .Any(diff => diff);

        // Determine metadata-only changes
        var codeChanged = (dto.ModuleCode is not null) && !string.Equals(originalCode, module.ModuleCode, StringComparison.Ordinal);
        var nameChanged = (dto.ModuleName is not null) && !string.Equals(originalName, module.ModuleName, StringComparison.Ordinal);
        var metadataChanged = codeChanged || nameChanged;

        // Consolidate schedule change flag (anything timetable-related)
        var scheduleChanged = classScheduleChanged || assessmentScheduleChanged;

        // ⚖️ Classification rule (single category per save):
        // - If any timetable-related change occurred → ScheduleUpdate
        // - Else if only metadata (code/name) changed → ModuleUpdate
        // - Else → no auto item
        var creator = User.GetUsername();

        if (scheduleChanged)
        {
            // Keep existing behaviour (may add both class & assessment schedule updates if both changed)
            if (classScheduleChanged)
            {
                var n = new Notification
                {
                    Title = $"[{module.ModuleCode}] Class schedule updated",
                    Message = $"The class timetable (venues/days/times) for {module.ModuleCode} has changed. Please check your schedule.",
                    Type = "ScheduleUpdate",
                    ModuleId = module.Id,
                    Audience = "ModuleStudents",          // all users linked to the module will see it (students/lecturers/coordinators) + creator via CreatedBy
                    CreatedBy = creator,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                context.Notifications.Add(n);
            }

            if (assessmentScheduleChanged)
            {
                var n = new Notification
                {
                    Title = $"[{module.ModuleCode}] Assessment schedule updated",
                    Message = $"The assessment schedule for {module.ModuleCode} has changed. Please check your assessment dates.",
                    Type = "ScheduleUpdate",
                    ModuleId = module.Id,
                    Audience = "ModuleStudents",
                    CreatedBy = creator,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                context.Notifications.Add(n);
            }

            await context.SaveChangesAsync();
        }
        else if (metadataChanged)
        {
            // 🆕 MODULE UPDATE (metadata only)
            // Build message with old → new details when available
            var changes = new List<string>();
            if (codeChanged) changes.Add($"{originalCode} → {module.ModuleCode}");
            if (nameChanged) changes.Add($"{originalName} → {module.ModuleName}");

            var changeText = changes.Count > 0
                ? $"The code/name for {string.Join(" / ", changes)} has changed."
                : "Module details were updated.";

            var n = new Notification
            {
                Title = $"[{module.ModuleCode}] Module details updated",
                Message = changeText,
                Type = "ModuleUpdate",
                ModuleId = module.Id,
                Audience = "ModuleStudents",           // visibility: all linked users + creator
                CreatedBy = creator,
                CreatedAt = DateTimeOffset.UtcNow
            };
            context.Notifications.Add(n);
            await context.SaveChangesAsync();
        }

        return Ok(new { message = "Module updated successfully." });
    }

    // EXACT as before (same route and roles)
    [Authorize(Roles = "Lecturer,Coordinator")]
    [HttpGet("assigned")]
    public async Task<ActionResult<IEnumerable<ModuleDto>>> GetAssignedModules()
    {
        var userId = int.Parse(User.GetUserId());

        var assignedModules = await context.UserModules
            .Where(um => um.AppUserId == userId &&
                         (um.RoleContext == "Lecturer" || um.RoleContext == "Coordinator"))
            .Include(um => um.Module)
                .ThenInclude(m => m.ClassSessions)
            .Select(um => um.Module)
            .ToListAsync();

        return assignedModules.Select(m => new ModuleDto
        {
            Id = m.Id,
            ModuleCode = m.ModuleCode,
            ModuleName = m.ModuleName,
            Semester = m.Semester,
            IsYearModule = m.IsYearModule,
            ClassVenue = m.ClassVenue,
            WeekDays = m.WeekDays?.Split(',') ?? [],
            StartTimes = m.StartTimes?.Split(',') ?? [],
            EndTimes = m.EndTimes?.Split(',') ?? [],
            ClassSessions = m.ClassSessions.Select(s => new ClassSessionDto
            {
                Id = s.Id,
                Venue = s.Venue,
                WeekDay = s.WeekDay,
                StartTime = s.StartTime,
                EndTime = s.EndTime
            }).ToList()
        }).ToList();
    }

    [Authorize(Roles = "Admin,Lecturer,Coordinator")]
    [HttpGet("{id}/assessments")]
    public async Task<ActionResult<IEnumerable<AssessmentDto>>> GetAssessmentsByModule(int id)
    {
        var assessments = await context.Assessments
            .Where(a => a.ModuleId == id)
            .ToListAsync();

        var results = assessments.Select(a => new AssessmentDto
        {
            Id = a.Id,
            Title = a.Title,
            Description = a.Description,           // return description
            Date = a.Date.ToString("yyyy-MM-dd"),
            StartTime = a.StartTime,
            EndTime = a.EndTime,
            DueTime = a.DueTime,
            Venue = a.Venue,
            IsTimed = a.IsTimed
        });

        return Ok(results);
    }

    [Authorize(Roles = "Admin,Lecturer,Coordinator")]
    [HttpGet("{id}")]
    public async Task<ActionResult<ModuleDto>> GetModuleById(int id)
    {
        var module = await context.Modules
            .Include(m => m.Assessments)
            .Include(m => m.ClassSessions)
            .FirstOrDefaultAsync(m => m.Id == id);

        if (module == null) return NotFound();

        return new ModuleDto
        {
            Id = module.Id,
            ModuleCode = module.ModuleCode,
            ModuleName = module.ModuleName,
            Semester = module.Semester,
            IsYearModule = module.IsYearModule,
            ClassVenue = module.ClassVenue,
            WeekDays = module.WeekDays?.Split(',') ?? [],
            StartTimes = module.StartTimes?.Split(',') ?? [],
            EndTimes = module.EndTimes?.Split(',') ?? [],
            ClassSessions = module.ClassSessions.Select(s => new ClassSessionDto
            {
                Id = s.Id,
                Venue = s.Venue,
                WeekDay = s.WeekDay,
                StartTime = s.StartTime,
                EndTime = s.EndTime
            }).ToList(),
            Assessments = module.Assessments.Select(a => new AssessmentDto
            {
                Id = a.Id,
                Title = a.Title,
                Description = a.Description,        // return description
                Date = a.Date.ToString("yyyy-MM-dd"),
                StartTime = a.StartTime,
                EndTime = a.EndTime,
                DueTime = a.DueTime,
                Venue = a.Venue,
                IsTimed = a.IsTimed
            }).ToList()
        };
    }
}
