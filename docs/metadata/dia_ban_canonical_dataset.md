# Regional Districts (Địa Bàn) Canonical Dataset

This document defines the canonical mapping of regional districts (địa bàn) for the qltbyt-nam-phong medical equipment management system.

## Overview

The regional district system provides hierarchical organization for medical facilities across administrative boundaries. Each `don_vi` (organizational unit) belongs to exactly one `dia_ban` (regional district).

## Administrative Hierarchy

```
Province (Tỉnh/Thành phố)
├── District (Quận/Huyện)  
    ├── Ward/Commune (Phường/Xã)
        └── Medical Facilities (Cơ sở y tế)
```

## Regional Districts Definition

### Production Regional Structure
The following baseline districts are provisioned in production:

| ma_dia_ban | ten_dia_ban | cap_do | parent_code | ten_lanh_dao | active |
|------------|-------------|--------|-------------|--------------|---------|
| VN_QUOC_GIA | Điều phối quốc gia | quoc_gia | NULL | Ban điều phối quốc gia | true |
| VN_TP_HCM | Thành phố Hồ Chí Minh | thanh_pho | VN_QUOC_GIA | Sở Y tế TP.HCM | true |
| VN_CAN_THO | Thành phố Cần Thơ | thanh_pho | VN_QUOC_GIA | Sở Y tế TP. Cần Thơ | true |
| VN_DOANH_NGHIEP | Cụm doanh nghiệp trang thiết bị y tế | to_chuc | VN_QUOC_GIA | Hiệp hội thiết bị y tế | true |

## Don Vi to Dia Ban Mapping

### Current Organizational Units (Production Data)
Based on `don_vi` records as of 2025-09-27:

| don_vi_id | don_vi_code | don_vi_name | dia_ban_assignment |
|-----------|-------------|-------------|-------------------|
| 1 | YKPNT | Trường Đại học Y khoa Phạm Ngọc Thạch | VN_TP_HCM |
| 2 | CVMEMS | CVMEMS | VN_DOANH_NGHIEP |
| 3 | CDC | Trung tâm Kiểm soát bệnh tật thành phố Cần Thơ | VN_CAN_THO |

## Regional Leader Access Patterns

### Access Scope by Role
- `global`: All dia_ban across system
- `regional_leader`: All don_vi within assigned dia_ban
- `admin`/`to_qltb`/others: Single don_vi only

### Example Access Matrix
```
Regional Leader "RL_CAN_THO" (assigned to VN_CAN_THO):
├── Can read: CDC (and all other don_vi assigned to VN_CAN_THO)
├── Cannot read: YKPNT, CVMEMS (different dia_ban)
└── Cannot write: Any entity (read-only role)
```

## Data Integrity Rules

### Required Fields
- `ma_dia_ban`: Unique identifier (convention: REGION_LEVEL_NAME)
- `ten_dia_ban`: Human-readable Vietnamese name
- `cap_do`: Administrative level (tinh, thanh_pho, huyen, xa, etc.)
- `active`: Must be true for operational regions

### Optional Fields  
- `parent_id`: For hierarchical organization
- `ten_lanh_dao`: Regional leader name
- `dia_chi`: Physical address
- `logo_dia_ban_url`: Regional logo/emblem

### Foreign Key Constraints
- `don_vi.dia_ban_id` → `dia_ban.id` (required after backfill)
- `nhan_vien.dia_ban_id` → `dia_ban.id` (optional)
- `dia_ban.parent_id` → `dia_ban.id` (optional, for hierarchy)

## Change Control Process

### Adding New Regional Districts
1. **Documentation**: Update this canonical dataset
2. **Review**: Stakeholder approval for administrative changes
3. **Implementation**: SQL INSERT with proper validation
4. **Verification**: Confirm don_vi assignments are correct
5. **Deployment**: Coordinate with system administrators

### Modifying Existing Districts
1. **Impact Assessment**: Identify affected don_vi and users
2. **Migration Plan**: Document reassignment strategy
3. **Rollback Plan**: Preserve original mappings
4. **Testing**: Validate access patterns in staging
5. **Communication**: Notify affected regional leaders

### Deactivating Districts
1. **Dependency Check**: Ensure no active don_vi remain assigned
2. **User Migration**: Reassign regional_leader users
3. **Soft Delete**: Set `active = false` (preserve historical data)
4. **Archive**: Move to historical records if needed

## Validation Queries

### Check Orphaned Don Vi
```sql
SELECT dv.id, dv.name, dv.dia_ban_id
FROM public.don_vi dv
LEFT JOIN public.dia_ban db ON dv.dia_ban_id = db.id
WHERE dv.dia_ban_id IS NOT NULL 
AND db.id IS NULL;
```

### Check Regional Leader Coverage
```sql
SELECT db.ma_dia_ban, db.ten_dia_ban,
       COUNT(dv.id) as don_vi_count,
       COUNT(nv.id) as regional_leader_count
FROM public.dia_ban db
LEFT JOIN public.don_vi dv ON db.id = dv.dia_ban_id
LEFT JOIN public.nhan_vien nv ON db.id = nv.dia_ban_id AND nv.role = 'regional_leader'
WHERE db.active = true
GROUP BY db.id, db.ma_dia_ban, db.ten_dia_ban;
```

### Verify Access Function
```sql
-- Test as different user roles
SELECT public.allowed_don_vi_for_session();
```

## Migration Notes

### Backfill Strategy
1. **Phase 1**: Create dia_ban records from this canonical dataset
2. **Phase 2**: Map existing don_vi to appropriate dia_ban_id
3. **Phase 3**: Assign regional_leader users to dia_ban_id
4. **Phase 4**: Enable foreign key constraints
5. **Phase 5**: Update RPCs to use new access patterns

### Performance Considerations
- Index on `don_vi.dia_ban_id` for efficient filtering
- Index on `dia_ban.parent_id` for hierarchical queries
- Consider materialized views for regional summaries
- Monitor query performance with `= ANY(array)` filters

## Security Notes

### Regional Leader Restrictions
- **Read-only**: Cannot modify any data, only view
- **Scope Limited**: Only see don_vi within assigned dia_ban
- **No User Management**: Cannot access user administration features
- **Audit Logged**: All access logged for compliance

### JWT Claims Extension
New claim added to authentication:
```json
{
  "role": "regional_leader",
  "don_vi": null,
  "dia_ban": 123,
  "khoa_phong": null
}
```

## Maintenance Schedule

### Regular Tasks
- **Monthly**: Review regional leader assignments
- **Quarterly**: Validate dia_ban to don_vi mappings  
- **Annually**: Update administrative boundaries per government changes
- **Ad-hoc**: Process organizational restructuring requests

---

**Document Version**: 1.1  
**Last Updated**: September 27, 2025  
**Owner**: System Architecture Team  
**Reviewers**: Regional Health Administration, IT Security Team