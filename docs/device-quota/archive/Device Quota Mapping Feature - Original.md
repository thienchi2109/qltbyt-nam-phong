# Device Quota Mapping Feature - Implementation Plan                                                                         
                                                                                                                                  
     > **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.                   
                                                                                                                                  
     **Goal:** Build a split-screen interface for mapping medical equipment to quota categories, with AI-powered suggestions, bulk
     operations, and HTML compliance reports per Circular 46/2025/TT-BYT.                                                         
                                                                                                                                  
     **Architecture:** New `/device-quota` route group with 3 sub-pages (Dashboard, Mapping, Decisions). Context-driven component 
     pattern following RepairRequests. RPC-only data access with tenant isolation. Gemini API for smart category suggestions.     
                                                                                                                                  
     **Tech Stack:** Next.js 15, React 18, TanStack Query v5, Radix UI, Tailwind CSS, Supabase PostgreSQL, Gemini API             
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ## MVP Scope Summary                                                                                                         
                                                                                                                                  
     | Feature | Status |                                                                                                         
     |---------|--------|                                                                                                         
     | Split-screen mapping interface | ✅ Included |                                                                             
     | Link/Unlink with bulk operations | ✅ Included |                                                                           
     | AI-powered category suggestion (Gemini) | ✅ Included |                                                                    
     | HTML report with signature block | ✅ Included |                                                                           
     | Quota decision CRUD + Excel import | ✅ Included |                                                                         
     | New "Định mức" navigation section | ✅ Included |                                                                          
     | Quota enforcement at Equipment Add/Import/Transfer | ⏸️ Phase 2 |                                                          
                                                                                                                                  
     ## Authorization Matrix                                                                                                      
                                                                                                                                  
     | Action | `global` | `to_qltb` | Others |                                                                                   
     |--------|:--------:|:---------:|:------:|                                                                                   
     | View all pages | ✅ | ✅ | ✅ (read-only) |                                                                                
     | Link/Unlink equipment | ✅ | ✅ | ❌ |                                                                                     
     | AI suggestion | ✅ | ✅ | ❌ |                                                                                             
     | Create/Edit decisions | ✅ | ✅ | ❌ |                                                                                     
     | Export HTML report | ✅ | ✅ | ✅ |                                                                                        
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ## Phase 1: Database Schema & RPC Functions                                                                                  
                                                                                                                                  
     ### Task 1.1: Create quota decision tables migration                                                                         
                                                                                                                                  
     **Files:**                                                                                                                   
     - Create: `supabase/migrations/20260131_device_quota_schema.sql`                                                             
                                                                                                                                  
     **Step 1: Write the migration SQL**                                                                                          
                                                                                                                                  
     ```sql                                                                                                                       
     -- Migration: Device Quota Schema                                                                                            
     -- Description: Tables for quota decisions, categories, and equipment mapping                                                
                                                                                                                                  
     -- Enable btree_gist for exclusion constraints                                                                               
     CREATE EXTENSION IF NOT EXISTS btree_gist;                                                                                   
                                                                                                                                  
     -- ============================================                                                                              
     -- Table: quyet_dinh_dinh_muc (Quota Decisions)                                                                              
     -- ============================================                                                                              
     CREATE TABLE IF NOT EXISTS public.quyet_dinh_dinh_muc (                                                                      
       id BIGSERIAL PRIMARY KEY,                                                                                                  
       don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,                                                  
       so_quyet_dinh TEXT NOT NULL,                                                                                               
       ngay_ban_hanh DATE NOT NULL,                                                                                               
       ngay_hieu_luc DATE NOT NULL,                                                                                               
       ngay_het_hieu_luc DATE,                                                                                                    
       nguoi_ky TEXT NOT NULL,                                                                                                    
       chuc_vu_nguoi_ky TEXT NOT NULL,                                                                                            
       trang_thai TEXT NOT NULL DEFAULT 'draft' CHECK (trang_thai IN ('draft', 'active', 'expired', 'replaced')),                 
       ghi_chu TEXT,                                                                                                              
       thay_the_cho_id BIGINT REFERENCES public.quyet_dinh_dinh_muc(id),                                                          
       created_by BIGINT,                                                                                                         
       updated_by BIGINT,                                                                                                         
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                                                             
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                                                             
                                                                                                                                  
       CONSTRAINT unique_active_decision_per_tenant                                                                               
         EXCLUDE USING gist (don_vi_id WITH =, daterange(ngay_hieu_luc, ngay_het_hieu_luc) WITH &&)                               
         WHERE (trang_thai = 'active')                                                                                            
     );                                                                                                                           
                                                                                                                                  
     CREATE INDEX idx_quyet_dinh_don_vi ON public.quyet_dinh_dinh_muc(don_vi_id);                                                 
     CREATE INDEX idx_quyet_dinh_trang_thai ON public.quyet_dinh_dinh_muc(trang_thai);                                            
                                                                                                                                  
     -- ============================================                                                                              
     -- Table: nhom_thiet_bi_dinh_muc (Quota Categories)                                                                          
     -- ============================================                                                                              
     CREATE TABLE IF NOT EXISTS public.nhom_thiet_bi_dinh_muc (                                                                   
       id BIGSERIAL PRIMARY KEY,                                                                                                  
       quyet_dinh_id BIGINT NOT NULL REFERENCES public.quyet_dinh_dinh_muc(id) ON DELETE CASCADE,                                 
       parent_id BIGINT REFERENCES public.nhom_thiet_bi_dinh_muc(id) ON DELETE CASCADE,                                           
       ma_nhom TEXT NOT NULL, -- e.g., "I", "A", "1", "a"                                                                         
       ten_nhom TEXT NOT NULL,                                                                                                    
       phan_loai TEXT CHECK (phan_loai IN ('A', 'B')), -- Nhóm A (đặc thù) or B (khác)                                            
       don_vi_tinh TEXT, -- e.g., "Cái", "Hệ thống"                                                                               
       so_luong_dinh_muc INT,                                                                                                     
       so_luong_toi_thieu INT,                                                                                                    
       thu_tu INT NOT NULL DEFAULT 0,                                                                                             
       ghi_chu TEXT,                                                                                                              
       keywords TEXT[], -- For smart mapping suggestions                                                                          
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                                                             
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                                                             
                                                                                                                                  
       CONSTRAINT unique_ma_nhom_per_decision UNIQUE (quyet_dinh_id, parent_id, ma_nhom)                                          
     );                                                                                                                           
                                                                                                                                  
     CREATE INDEX idx_nhom_thiet_bi_quyet_dinh ON public.nhom_thiet_bi_dinh_muc(quyet_dinh_id);                                   
     CREATE INDEX idx_nhom_thiet_bi_parent ON public.nhom_thiet_bi_dinh_muc(parent_id);                                           
                                                                                                                                  
     -- ============================================                                                                              
     -- Alter thiet_bi: Add nhom_thiet_bi_id column                                                                               
     -- ============================================                                                                              
     ALTER TABLE public.thiet_bi                                                                                                  
     ADD COLUMN IF NOT EXISTS nhom_thiet_bi_id BIGINT REFERENCES public.nhom_thiet_bi_dinh_muc(id) ON DELETE SET NULL;            
                                                                                                                                  
     CREATE INDEX IF NOT EXISTS idx_thiet_bi_nhom ON public.thiet_bi(nhom_thiet_bi_id);                                           
                                                                                                                                  
     -- ============================================                                                                              
     -- Table: thiet_bi_nhom_audit_log (Link/Unlink Audit)                                                                        
     -- ============================================                                                                              
     CREATE TABLE IF NOT EXISTS public.thiet_bi_nhom_audit_log (                                                                  
       id BIGSERIAL PRIMARY KEY,                                                                                                  
       don_vi_id BIGINT NOT NULL,                                                                                                 
       action TEXT NOT NULL CHECK (action IN ('link', 'unlink')),                                                                 
       thiet_bi_ids BIGINT[] NOT NULL,                                                                                            
       nhom_thiet_bi_id BIGINT,                                                                                                   
       performed_by BIGINT NOT NULL,                                                                                              
       performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                                                                            
     );                                                                                                                           
                                                                                                                                  
     CREATE INDEX idx_audit_log_don_vi ON public.thiet_bi_nhom_audit_log(don_vi_id);                                              
     CREATE INDEX idx_audit_log_performed_at ON public.thiet_bi_nhom_audit_log(performed_at DESC);                                
                                                                                                                                  
     -- ============================================                                                                              
     -- Trigger: Update updated_at timestamp                                                                                      
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION update_updated_at_column()                                                                        
     RETURNS TRIGGER AS $$                                                                                                        
     BEGIN                                                                                                                        
       NEW.updated_at = NOW();                                                                                                    
       RETURN NEW;                                                                                                                
     END;                                                                                                                         
     $$ LANGUAGE plpgsql;                                                                                                         
                                                                                                                                  
     CREATE TRIGGER update_quyet_dinh_updated_at                                                                                  
       BEFORE UPDATE ON public.quyet_dinh_dinh_muc                                                                                
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();                                                                  
                                                                                                                                  
     CREATE TRIGGER update_nhom_thiet_bi_updated_at                                                                               
       BEFORE UPDATE ON public.nhom_thiet_bi_dinh_muc                                                                             
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();                                                                  
                                                                                                                                  
     -- Grant permissions                                                                                                         
     GRANT SELECT, INSERT, UPDATE, DELETE ON public.quyet_dinh_dinh_muc TO authenticated;                                         
     GRANT SELECT, INSERT, UPDATE, DELETE ON public.nhom_thiet_bi_dinh_muc TO authenticated;                                      
     GRANT SELECT, INSERT ON public.thiet_bi_nhom_audit_log TO authenticated;                                                     
     GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;                                                      
     ```                                                                                                                          
                                                                                                                                  
     **Step 2: Apply migration via Supabase MCP**                                                                                 
                                                                                                                                  
     Run: `mcp__supabase__apply_migration` with name `20260131_device_quota_schema`                                               
                                                                                                                                  
     **Step 3: Verify tables created**                                                                                            
                                                                                                                                  
     Run SQL: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%dinh_muc%' OR 
     table_name LIKE '%nhom_thiet_bi%';`                                                                                          
                                                                                                                                  
     **Step 4: Commit**                                                                                                           
                                                                                                                                  
     ```bash                                                                                                                      
     git add supabase/migrations/20260131_device_quota_schema.sql                                                                 
     git commit -m "feat(db): add device quota schema - decisions, categories, audit log"                                         
     ```                                                                                                                          
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ### Task 1.2: Create RPC functions for quota decisions                                                                       
                                                                                                                                  
     **Files:**                                                                                                                   
     - Create: `supabase/migrations/20260131_device_quota_rpc_decisions.sql`                                                      
                                                                                                                                  
     **Step 1: Write the RPC functions**                                                                                          
                                                                                                                                  
     ```sql                                                                                                                       
     -- ============================================                                                                              
     -- RPC: dinh_muc_quyet_dinh_list                                                                                             
     -- List quota decisions for a tenant                                                                                         
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_list(                                                                  
       p_don_vi BIGINT DEFAULT NULL,                                                                                              
       p_trang_thai TEXT DEFAULT NULL                                                                                             
     )                                                                                                                            
     RETURNS TABLE (                                                                                                              
       id BIGINT,                                                                                                                 
       don_vi_id BIGINT,                                                                                                          
       so_quyet_dinh TEXT,                                                                                                        
       ngay_ban_hanh DATE,                                                                                                        
       ngay_hieu_luc DATE,                                                                                                        
       ngay_het_hieu_luc DATE,                                                                                                    
       nguoi_ky TEXT,                                                                                                             
       chuc_vu_nguoi_ky TEXT,                                                                                                     
       trang_thai TEXT,                                                                                                           
       ghi_chu TEXT,                                                                                                              
       thay_the_cho_id BIGINT,                                                                                                    
       created_at TIMESTAMPTZ,                                                                                                    
       updated_at TIMESTAMPTZ,                                                                                                    
       total_categories BIGINT,                                                                                                   
       total_equipment_mapped BIGINT                                                                                              
     )                                                                                                                            
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
     BEGIN                                                                                                                        
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       RETURN QUERY                                                                                                               
       SELECT                                                                                                                     
         qd.id,                                                                                                                   
         qd.don_vi_id,                                                                                                            
         qd.so_quyet_dinh,                                                                                                        
         qd.ngay_ban_hanh,                                                                                                        
         qd.ngay_hieu_luc,                                                                                                        
         qd.ngay_het_hieu_luc,                                                                                                    
         qd.nguoi_ky,                                                                                                             
         qd.chuc_vu_nguoi_ky,                                                                                                     
         qd.trang_thai,                                                                                                           
         qd.ghi_chu,                                                                                                              
         qd.thay_the_cho_id,                                                                                                      
         qd.created_at,                                                                                                           
         qd.updated_at,                                                                                                           
         (SELECT COUNT(*) FROM nhom_thiet_bi_dinh_muc n WHERE n.quyet_dinh_id = qd.id) AS total_categories,                       
         (SELECT COUNT(*) FROM thiet_bi t                                                                                         
          JOIN nhom_thiet_bi_dinh_muc n ON t.nhom_thiet_bi_id = n.id                                                              
          WHERE n.quyet_dinh_id = qd.id) AS total_equipment_mapped                                                                
       FROM quyet_dinh_dinh_muc qd                                                                                                
       WHERE qd.don_vi_id = p_don_vi                                                                                              
         AND (p_trang_thai IS NULL OR qd.trang_thai = p_trang_thai)                                                               
       ORDER BY qd.ngay_hieu_luc DESC, qd.created_at DESC;                                                                        
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_list TO authenticated;                                                  
                                                                                                                                  
     -- ============================================                                                                              
     -- RPC: dinh_muc_quyet_dinh_create                                                                                           
     -- Create a new quota decision                                                                                               
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_create(                                                                
       p_don_vi BIGINT DEFAULT NULL,                                                                                              
       p_so_quyet_dinh TEXT DEFAULT NULL,                                                                                         
       p_ngay_ban_hanh DATE DEFAULT NULL,                                                                                         
       p_ngay_hieu_luc DATE DEFAULT NULL,                                                                                         
       p_ngay_het_hieu_luc DATE DEFAULT NULL,                                                                                     
       p_nguoi_ky TEXT DEFAULT NULL,                                                                                              
       p_chuc_vu_nguoi_ky TEXT DEFAULT NULL,                                                                                      
       p_ghi_chu TEXT DEFAULT NULL                                                                                                
     )                                                                                                                            
     RETURNS BIGINT                                                                                                               
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
       v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';                                           
       v_new_id BIGINT;                                                                                                           
     BEGIN                                                                                                                        
       -- Permission check                                                                                                        
       IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN                                                                       
         RAISE EXCEPTION 'Insufficient permissions to create quota decision';                                                     
       END IF;                                                                                                                    
                                                                                                                                  
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       -- Validation                                                                                                              
       IF p_so_quyet_dinh IS NULL OR p_ngay_ban_hanh IS NULL OR p_ngay_hieu_luc IS NULL THEN                                      
         RAISE EXCEPTION 'Missing required fields: so_quyet_dinh, ngay_ban_hanh, ngay_hieu_luc';                                  
       END IF;                                                                                                                    
                                                                                                                                  
       INSERT INTO quyet_dinh_dinh_muc (                                                                                          
         don_vi_id, so_quyet_dinh, ngay_ban_hanh, ngay_hieu_luc, ngay_het_hieu_luc,                                               
         nguoi_ky, chuc_vu_nguoi_ky, ghi_chu, trang_thai, created_by                                                              
       ) VALUES (                                                                                                                 
         p_don_vi, p_so_quyet_dinh, p_ngay_ban_hanh, p_ngay_hieu_luc, p_ngay_het_hieu_luc,                                        
         p_nguoi_ky, p_chuc_vu_nguoi_ky, p_ghi_chu, 'draft', v_user_id::BIGINT                                                    
       )                                                                                                                          
       RETURNING id INTO v_new_id;                                                                                                
                                                                                                                                  
       RETURN v_new_id;                                                                                                           
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_create TO authenticated;                                                
                                                                                                                                  
     -- ============================================                                                                              
     -- RPC: dinh_muc_quyet_dinh_update                                                                                           
     -- Update a quota decision                                                                                                   
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_update(                                                                
       p_id BIGINT,                                                                                                               
       p_don_vi BIGINT DEFAULT NULL,                                                                                              
       p_so_quyet_dinh TEXT DEFAULT NULL,                                                                                         
       p_ngay_ban_hanh DATE DEFAULT NULL,                                                                                         
       p_ngay_hieu_luc DATE DEFAULT NULL,                                                                                         
       p_ngay_het_hieu_luc DATE DEFAULT NULL,                                                                                     
       p_nguoi_ky TEXT DEFAULT NULL,                                                                                              
       p_chuc_vu_nguoi_ky TEXT DEFAULT NULL,                                                                                      
       p_ghi_chu TEXT DEFAULT NULL                                                                                                
     )                                                                                                                            
     RETURNS BOOLEAN                                                                                                              
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
       v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';                                           
       v_existing RECORD;                                                                                                         
     BEGIN                                                                                                                        
       -- Permission check                                                                                                        
       IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN                                                                       
         RAISE EXCEPTION 'Insufficient permissions';                                                                              
       END IF;                                                                                                                    
                                                                                                                                  
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       -- Get existing record                                                                                                     
       SELECT * INTO v_existing FROM quyet_dinh_dinh_muc WHERE id = p_id AND don_vi_id = p_don_vi;                                
       IF NOT FOUND THEN                                                                                                          
         RAISE EXCEPTION 'Decision not found or access denied';                                                                   
       END IF;                                                                                                                    
                                                                                                                                  
       -- Cannot edit active decisions (immutability)                                                                             
       IF v_existing.trang_thai = 'active' THEN                                                                                   
         RAISE EXCEPTION 'Cannot edit active decisions. Create a replacement instead.';                                           
       END IF;                                                                                                                    
                                                                                                                                  
       UPDATE quyet_dinh_dinh_muc SET                                                                                             
         so_quyet_dinh = COALESCE(p_so_quyet_dinh, so_quyet_dinh),                                                                
         ngay_ban_hanh = COALESCE(p_ngay_ban_hanh, ngay_ban_hanh),                                                                
         ngay_hieu_luc = COALESCE(p_ngay_hieu_luc, ngay_hieu_luc),                                                                
         ngay_het_hieu_luc = p_ngay_het_hieu_luc,                                                                                 
         nguoi_ky = COALESCE(p_nguoi_ky, nguoi_ky),                                                                               
         chuc_vu_nguoi_ky = COALESCE(p_chuc_vu_nguoi_ky, chuc_vu_nguoi_ky),                                                       
         ghi_chu = p_ghi_chu,                                                                                                     
         updated_by = v_user_id::BIGINT                                                                                           
       WHERE id = p_id;                                                                                                           
                                                                                                                                  
       RETURN TRUE;                                                                                                               
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_update TO authenticated;                                                
                                                                                                                                  
     -- ============================================                                                                              
     -- RPC: dinh_muc_quyet_dinh_activate                                                                                         
     -- Activate a quota decision (deactivates previous)                                                                          
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_activate(                                                              
       p_id BIGINT,                                                                                                               
       p_don_vi BIGINT DEFAULT NULL                                                                                               
     )                                                                                                                            
     RETURNS BOOLEAN                                                                                                              
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
       v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';                                           
       v_existing RECORD;                                                                                                         
     BEGIN                                                                                                                        
       -- Permission check                                                                                                        
       IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN                                                                       
         RAISE EXCEPTION 'Insufficient permissions';                                                                              
       END IF;                                                                                                                    
                                                                                                                                  
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       -- Get the decision to activate                                                                                            
       SELECT * INTO v_existing FROM quyet_dinh_dinh_muc WHERE id = p_id AND don_vi_id = p_don_vi;                                
       IF NOT FOUND THEN                                                                                                          
         RAISE EXCEPTION 'Decision not found';                                                                                    
       END IF;                                                                                                                    
                                                                                                                                  
       -- Deactivate current active decision                                                                                      
       UPDATE quyet_dinh_dinh_muc                                                                                                 
       SET trang_thai = 'replaced',                                                                                               
           ngay_het_hieu_luc = CURRENT_DATE,                                                                                      
           updated_by = v_user_id::BIGINT                                                                                         
       WHERE don_vi_id = p_don_vi                                                                                                 
         AND trang_thai = 'active'                                                                                                
         AND id != p_id;                                                                                                          
                                                                                                                                  
       -- Activate the new decision                                                                                               
       UPDATE quyet_dinh_dinh_muc                                                                                                 
       SET trang_thai = 'active',                                                                                                 
           updated_by = v_user_id::BIGINT                                                                                         
       WHERE id = p_id;                                                                                                           
                                                                                                                                  
       RETURN TRUE;                                                                                                               
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_activate TO authenticated;                                              
                                                                                                                                  
     -- ============================================                                                                              
     -- RPC: dinh_muc_quyet_dinh_delete                                                                                           
     -- Delete a draft quota decision                                                                                             
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_delete(                                                                
       p_id BIGINT,                                                                                                               
       p_don_vi BIGINT DEFAULT NULL                                                                                               
     )                                                                                                                            
     RETURNS BOOLEAN                                                                                                              
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
       v_existing RECORD;                                                                                                         
     BEGIN                                                                                                                        
       -- Permission check                                                                                                        
       IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN                                                                       
         RAISE EXCEPTION 'Insufficient permissions';                                                                              
       END IF;                                                                                                                    
                                                                                                                                  
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       SELECT * INTO v_existing FROM quyet_dinh_dinh_muc WHERE id = p_id AND don_vi_id = p_don_vi;                                
       IF NOT FOUND THEN                                                                                                          
         RAISE EXCEPTION 'Decision not found';                                                                                    
       END IF;                                                                                                                    
                                                                                                                                  
       -- Only allow deleting draft decisions                                                                                     
       IF v_existing.trang_thai != 'draft' THEN                                                                                   
         RAISE EXCEPTION 'Can only delete draft decisions';                                                                       
       END IF;                                                                                                                    
                                                                                                                                  
       DELETE FROM quyet_dinh_dinh_muc WHERE id = p_id;                                                                           
                                                                                                                                  
       RETURN TRUE;                                                                                                               
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_delete TO authenticated;                                                
     ```                                                                                                                          
                                                                                                                                  
     **Step 2: Apply migration**                                                                                                  
                                                                                                                                  
     Run: `mcp__supabase__apply_migration` with name `20260131_device_quota_rpc_decisions`                                        
                                                                                                                                  
     **Step 3: Commit**                                                                                                           
                                                                                                                                  
     ```bash                                                                                                                      
     git add supabase/migrations/20260131_device_quota_rpc_decisions.sql                                                          
     git commit -m "feat(db): add RPC functions for quota decisions CRUD"                                                         
     ```                                                                                                                          
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ### Task 1.3: Create RPC functions for categories and mapping                                                                
                                                                                                                                  
     **Files:**                                                                                                                   
     - Create: `supabase/migrations/20260131_device_quota_rpc_mapping.sql`                                                        
                                                                                                                                  
     **Step 1: Write the RPC functions**                                                                                          
                                                                                                                                  
     ```sql                                                                                                                       
     -- ============================================                                                                              
     -- RPC: dinh_muc_nhom_list                                                                                                   
     -- List categories for a decision (tree structure)                                                                           
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_list(                                                                        
       p_quyet_dinh_id BIGINT,                                                                                                    
       p_don_vi BIGINT DEFAULT NULL                                                                                               
     )                                                                                                                            
     RETURNS TABLE (                                                                                                              
       id BIGINT,                                                                                                                 
       quyet_dinh_id BIGINT,                                                                                                      
       parent_id BIGINT,                                                                                                          
       ma_nhom TEXT,                                                                                                              
       ten_nhom TEXT,                                                                                                             
       phan_loai TEXT,                                                                                                            
       don_vi_tinh TEXT,                                                                                                          
       so_luong_dinh_muc INT,                                                                                                     
       so_luong_toi_thieu INT,                                                                                                    
       thu_tu INT,                                                                                                                
       ghi_chu TEXT,                                                                                                              
       keywords TEXT[],                                                                                                           
       level INT,                                                                                                                 
       so_luong_hien_co BIGINT                                                                                                    
     )                                                                                                                            
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
     BEGIN                                                                                                                        
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       -- Verify decision belongs to tenant                                                                                       
       IF NOT EXISTS (                                                                                                            
         SELECT 1 FROM quyet_dinh_dinh_muc                                                                                        
         WHERE id = p_quyet_dinh_id AND don_vi_id = p_don_vi                                                                      
       ) THEN                                                                                                                     
         RAISE EXCEPTION 'Decision not found or access denied';                                                                   
       END IF;                                                                                                                    
                                                                                                                                  
       RETURN QUERY                                                                                                               
       WITH RECURSIVE category_tree AS (                                                                                          
         -- Root nodes                                                                                                            
         SELECT                                                                                                                   
           n.id, n.quyet_dinh_id, n.parent_id, n.ma_nhom, n.ten_nhom,                                                             
           n.phan_loai, n.don_vi_tinh, n.so_luong_dinh_muc, n.so_luong_toi_thieu,                                                 
           n.thu_tu, n.ghi_chu, n.keywords,                                                                                       
           0 AS level                                                                                                             
         FROM nhom_thiet_bi_dinh_muc n                                                                                            
         WHERE n.quyet_dinh_id = p_quyet_dinh_id AND n.parent_id IS NULL                                                          
                                                                                                                                  
         UNION ALL                                                                                                                
                                                                                                                                  
         -- Child nodes                                                                                                           
         SELECT                                                                                                                   
           n.id, n.quyet_dinh_id, n.parent_id, n.ma_nhom, n.ten_nhom,                                                             
           n.phan_loai, n.don_vi_tinh, n.so_luong_dinh_muc, n.so_luong_toi_thieu,                                                 
           n.thu_tu, n.ghi_chu, n.keywords,                                                                                       
           ct.level + 1                                                                                                           
         FROM nhom_thiet_bi_dinh_muc n                                                                                            
         JOIN category_tree ct ON n.parent_id = ct.id                                                                             
       )                                                                                                                          
       SELECT                                                                                                                     
         ct.id, ct.quyet_dinh_id, ct.parent_id, ct.ma_nhom, ct.ten_nhom,                                                          
         ct.phan_loai, ct.don_vi_tinh, ct.so_luong_dinh_muc, ct.so_luong_toi_thieu,                                               
         ct.thu_tu, ct.ghi_chu, ct.keywords, ct.level,                                                                            
         (SELECT COUNT(*) FROM thiet_bi t WHERE t.nhom_thiet_bi_id = ct.id AND t.don_vi = p_don_vi)::BIGINT AS so_luong_hien_co   
       FROM category_tree ct                                                                                                      
       ORDER BY ct.level, ct.thu_tu, ct.ma_nhom;                                                                                  
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_list TO authenticated;                                                        
                                                                                                                                  
     -- ============================================                                                                              
     -- RPC: dinh_muc_nhom_upsert                                                                                                 
     -- Create or update a category                                                                                               
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_upsert(                                                                      
       p_id BIGINT DEFAULT NULL,                                                                                                  
       p_quyet_dinh_id BIGINT DEFAULT NULL,                                                                                       
       p_parent_id BIGINT DEFAULT NULL,                                                                                           
       p_ma_nhom TEXT DEFAULT NULL,                                                                                               
       p_ten_nhom TEXT DEFAULT NULL,                                                                                              
       p_phan_loai TEXT DEFAULT NULL,                                                                                             
       p_don_vi_tinh TEXT DEFAULT NULL,                                                                                           
       p_so_luong_dinh_muc INT DEFAULT NULL,                                                                                      
       p_so_luong_toi_thieu INT DEFAULT NULL,                                                                                     
       p_thu_tu INT DEFAULT 0,                                                                                                    
       p_ghi_chu TEXT DEFAULT NULL,                                                                                               
       p_keywords TEXT[] DEFAULT NULL,                                                                                            
       p_don_vi BIGINT DEFAULT NULL                                                                                               
     )                                                                                                                            
     RETURNS BIGINT                                                                                                               
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
       v_result_id BIGINT;                                                                                                        
     BEGIN                                                                                                                        
       -- Permission check                                                                                                        
       IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN                                                                       
         RAISE EXCEPTION 'Insufficient permissions';                                                                              
       END IF;                                                                                                                    
                                                                                                                                  
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       -- Verify decision belongs to tenant and is draft                                                                          
       IF NOT EXISTS (                                                                                                            
         SELECT 1 FROM quyet_dinh_dinh_muc                                                                                        
         WHERE id = p_quyet_dinh_id AND don_vi_id = p_don_vi AND trang_thai = 'draft'                                             
       ) THEN                                                                                                                     
         RAISE EXCEPTION 'Decision not found, not a draft, or access denied';                                                     
       END IF;                                                                                                                    
                                                                                                                                  
       IF p_id IS NULL THEN                                                                                                       
         -- Insert new                                                                                                            
         INSERT INTO nhom_thiet_bi_dinh_muc (                                                                                     
           quyet_dinh_id, parent_id, ma_nhom, ten_nhom, phan_loai,                                                                
           don_vi_tinh, so_luong_dinh_muc, so_luong_toi_thieu, thu_tu, ghi_chu, keywords                                          
         ) VALUES (                                                                                                               
           p_quyet_dinh_id, p_parent_id, p_ma_nhom, p_ten_nhom, p_phan_loai,                                                      
           p_don_vi_tinh, p_so_luong_dinh_muc, p_so_luong_toi_thieu, p_thu_tu, p_ghi_chu, p_keywords                              
         )                                                                                                                        
         RETURNING id INTO v_result_id;                                                                                           
       ELSE                                                                                                                       
         -- Update existing                                                                                                       
         UPDATE nhom_thiet_bi_dinh_muc SET                                                                                        
           parent_id = COALESCE(p_parent_id, parent_id),                                                                          
           ma_nhom = COALESCE(p_ma_nhom, ma_nhom),                                                                                
           ten_nhom = COALESCE(p_ten_nhom, ten_nhom),                                                                             
           phan_loai = p_phan_loai,                                                                                               
           don_vi_tinh = p_don_vi_tinh,                                                                                           
           so_luong_dinh_muc = p_so_luong_dinh_muc,                                                                               
           so_luong_toi_thieu = p_so_luong_toi_thieu,                                                                             
           thu_tu = COALESCE(p_thu_tu, thu_tu),                                                                                   
           ghi_chu = p_ghi_chu,                                                                                                   
           keywords = p_keywords                                                                                                  
         WHERE id = p_id                                                                                                          
         RETURNING id INTO v_result_id;                                                                                           
       END IF;                                                                                                                    
                                                                                                                                  
       RETURN v_result_id;                                                                                                        
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_upsert TO authenticated;                                                      
                                                                                                                                  
     -- ============================================                                                                              
     -- RPC: dinh_muc_thiet_bi_link                                                                                               
     -- Link equipment to a category (bulk)                                                                                       
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_link(                                                                    
       p_thiet_bi_ids BIGINT[],                                                                                                   
       p_nhom_id BIGINT,                                                                                                          
       p_don_vi BIGINT DEFAULT NULL                                                                                               
     )                                                                                                                            
     RETURNS INT                                                                                                                  
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
       v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';                                           
       v_count INT;                                                                                                               
     BEGIN                                                                                                                        
       -- Permission check                                                                                                        
       IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN                                                                       
         RAISE EXCEPTION 'Insufficient permissions';                                                                              
       END IF;                                                                                                                    
                                                                                                                                  
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       -- Verify category exists                                                                                                  
       IF NOT EXISTS (SELECT 1 FROM nhom_thiet_bi_dinh_muc WHERE id = p_nhom_id) THEN                                             
         RAISE EXCEPTION 'Category not found';                                                                                    
       END IF;                                                                                                                    
                                                                                                                                  
       -- Update equipment                                                                                                        
       UPDATE thiet_bi                                                                                                            
       SET nhom_thiet_bi_id = p_nhom_id                                                                                           
       WHERE id = ANY(p_thiet_bi_ids)                                                                                             
         AND don_vi = p_don_vi;                                                                                                   
                                                                                                                                  
       GET DIAGNOSTICS v_count = ROW_COUNT;                                                                                       
                                                                                                                                  
       -- Audit log                                                                                                               
       INSERT INTO thiet_bi_nhom_audit_log (don_vi_id, action, thiet_bi_ids, nhom_thiet_bi_id, performed_by)                      
       VALUES (p_don_vi, 'link', p_thiet_bi_ids, p_nhom_id, v_user_id::BIGINT);                                                   
                                                                                                                                  
       RETURN v_count;                                                                                                            
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_link TO authenticated;                                                    
                                                                                                                                  
     -- ============================================                                                                              
     -- RPC: dinh_muc_thiet_bi_unlink                                                                                             
     -- Unlink equipment from category (bulk)                                                                                     
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_unlink(                                                                  
       p_thiet_bi_ids BIGINT[],                                                                                                   
       p_don_vi BIGINT DEFAULT NULL                                                                                               
     )                                                                                                                            
     RETURNS INT                                                                                                                  
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
       v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';                                           
       v_nhom_id BIGINT;                                                                                                          
       v_count INT;                                                                                                               
     BEGIN                                                                                                                        
       -- Permission check                                                                                                        
       IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN                                                                       
         RAISE EXCEPTION 'Insufficient permissions';                                                                              
       END IF;                                                                                                                    
                                                                                                                                  
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       -- Get the current nhom_id for audit (use first equipment's nhom)                                                          
       SELECT nhom_thiet_bi_id INTO v_nhom_id                                                                                     
       FROM thiet_bi                                                                                                              
       WHERE id = p_thiet_bi_ids[1] AND don_vi = p_don_vi;                                                                        
                                                                                                                                  
       -- Update equipment                                                                                                        
       UPDATE thiet_bi                                                                                                            
       SET nhom_thiet_bi_id = NULL                                                                                                
       WHERE id = ANY(p_thiet_bi_ids)                                                                                             
         AND don_vi = p_don_vi;                                                                                                   
                                                                                                                                  
       GET DIAGNOSTICS v_count = ROW_COUNT;                                                                                       
                                                                                                                                  
       -- Audit log                                                                                                               
       INSERT INTO thiet_bi_nhom_audit_log (don_vi_id, action, thiet_bi_ids, nhom_thiet_bi_id, performed_by)                      
       VALUES (p_don_vi, 'unlink', p_thiet_bi_ids, v_nhom_id, v_user_id::BIGINT);                                                 
                                                                                                                                  
       RETURN v_count;                                                                                                            
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unlink TO authenticated;                                                  
                                                                                                                                  
     -- ============================================                                                                              
     -- RPC: dinh_muc_thiet_bi_unassigned                                                                                         
     -- List equipment not assigned to any category                                                                               
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_unassigned(                                                              
       p_don_vi BIGINT DEFAULT NULL,                                                                                              
       p_search TEXT DEFAULT NULL,                                                                                                
       p_limit INT DEFAULT 50,                                                                                                    
       p_offset INT DEFAULT 0                                                                                                     
     )                                                                                                                            
     RETURNS TABLE (                                                                                                              
       id BIGINT,                                                                                                                 
       ma_thiet_bi TEXT,                                                                                                          
       ten_thiet_bi TEXT,                                                                                                         
       model TEXT,                                                                                                                
       serial TEXT,                                                                                                               
       hang_san_xuat TEXT,                                                                                                        
       khoa_phong_quan_ly TEXT,                                                                                                   
       tinh_trang TEXT                                                                                                            
     )                                                                                                                            
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
     BEGIN                                                                                                                        
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       RETURN QUERY                                                                                                               
       SELECT                                                                                                                     
         t.id,                                                                                                                    
         t.ma_thiet_bi,                                                                                                           
         t.ten_thiet_bi,                                                                                                          
         t.model,                                                                                                                 
         t.serial,                                                                                                                
         t.hang_san_xuat,                                                                                                         
         t.khoa_phong_quan_ly,                                                                                                    
         t.tinh_trang                                                                                                             
       FROM thiet_bi t                                                                                                            
       WHERE t.don_vi = p_don_vi                                                                                                  
         AND t.nhom_thiet_bi_id IS NULL                                                                                           
         AND (                                                                                                                    
           p_search IS NULL                                                                                                       
           OR t.ten_thiet_bi ILIKE '%' || p_search || '%'                                                                         
           OR t.ma_thiet_bi ILIKE '%' || p_search || '%'                                                                          
           OR t.model ILIKE '%' || p_search || '%'                                                                                
           OR t.serial ILIKE '%' || p_search || '%'                                                                               
         )                                                                                                                        
       ORDER BY t.ten_thiet_bi                                                                                                    
       LIMIT p_limit OFFSET p_offset;                                                                                             
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned TO authenticated;                                              
                                                                                                                                  
     -- ============================================                                                                              
     -- RPC: dinh_muc_thiet_bi_by_nhom                                                                                            
     -- List equipment assigned to a category                                                                                     
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_by_nhom(                                                                 
       p_nhom_id BIGINT,                                                                                                          
       p_don_vi BIGINT DEFAULT NULL                                                                                               
     )                                                                                                                            
     RETURNS TABLE (                                                                                                              
       id BIGINT,                                                                                                                 
       ma_thiet_bi TEXT,                                                                                                          
       ten_thiet_bi TEXT,                                                                                                         
       model TEXT,                                                                                                                
       serial TEXT,                                                                                                               
       hang_san_xuat TEXT,                                                                                                        
       khoa_phong_quan_ly TEXT,                                                                                                   
       tinh_trang TEXT                                                                                                            
     )                                                                                                                            
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
     BEGIN                                                                                                                        
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       RETURN QUERY                                                                                                               
       SELECT                                                                                                                     
         t.id,                                                                                                                    
         t.ma_thiet_bi,                                                                                                           
         t.ten_thiet_bi,                                                                                                          
         t.model,                                                                                                                 
         t.serial,                                                                                                                
         t.hang_san_xuat,                                                                                                         
         t.khoa_phong_quan_ly,                                                                                                    
         t.tinh_trang                                                                                                             
       FROM thiet_bi t                                                                                                            
       WHERE t.don_vi = p_don_vi                                                                                                  
         AND t.nhom_thiet_bi_id = p_nhom_id                                                                                       
       ORDER BY t.ten_thiet_bi;                                                                                                   
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_by_nhom TO authenticated;                                                 
                                                                                                                                  
     -- ============================================                                                                              
     -- RPC: dinh_muc_compliance_summary                                                                                          
     -- Get compliance summary for a decision                                                                                     
     -- ============================================                                                                              
     CREATE OR REPLACE FUNCTION public.dinh_muc_compliance_summary(                                                               
       p_quyet_dinh_id BIGINT,                                                                                                    
       p_don_vi BIGINT DEFAULT NULL                                                                                               
     )                                                                                                                            
     RETURNS TABLE (                                                                                                              
       total_categories BIGINT,                                                                                                   
       dat_count BIGINT,                                                                                                          
       thieu_count BIGINT,                                                                                                        
       vuot_count BIGINT,                                                                                                         
       unassigned_equipment BIGINT                                                                                                
     )                                                                                                                            
     LANGUAGE plpgsql                                                                                                             
     SECURITY DEFINER                                                                                                             
     SET search_path = public                                                                                                     
     AS $$                                                                                                                        
     DECLARE                                                                                                                      
       v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';                                             
       v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';                                             
     BEGIN                                                                                                                        
       -- Tenant isolation                                                                                                        
       IF v_role NOT IN ('global', 'admin') THEN                                                                                  
         p_don_vi := v_don_vi::BIGINT;                                                                                            
       END IF;                                                                                                                    
                                                                                                                                  
       RETURN QUERY                                                                                                               
       WITH category_status AS (                                                                                                  
         SELECT                                                                                                                   
           n.id,                                                                                                                  
           n.so_luong_dinh_muc,                                                                                                   
           n.so_luong_toi_thieu,                                                                                                  
           (SELECT COUNT(*) FROM thiet_bi t WHERE t.nhom_thiet_bi_id = n.id AND t.don_vi = p_don_vi) AS actual_count,             
           CASE                                                                                                                   
             WHEN n.so_luong_dinh_muc IS NULL THEN 'dat'                                                                          
             WHEN (SELECT COUNT(*) FROM thiet_bi t WHERE t.nhom_thiet_bi_id = n.id AND t.don_vi = p_don_vi) > n.so_luong_dinh_muc 
     THEN 'vuot'                                                                                                                  
             WHEN n.so_luong_toi_thieu IS NOT NULL                                                                                
               AND (SELECT COUNT(*) FROM thiet_bi t WHERE t.nhom_thiet_bi_id = n.id AND t.don_vi = p_don_vi) < n.so_luong_toi_thie
      THEN 'thieu'                                                                                                                
             ELSE 'dat'                                                                                                           
           END AS status                                                                                                          
         FROM nhom_thiet_bi_dinh_muc n                                                                                            
         WHERE n.quyet_dinh_id = p_quyet_dinh_id                                                                                  
           AND n.so_luong_dinh_muc IS NOT NULL -- Only leaf categories with quotas                                                
       )                                                                                                                          
       SELECT                                                                                                                     
         (SELECT COUNT(*) FROM category_status)::BIGINT AS total_categories,                                                      
         (SELECT COUNT(*) FROM category_status WHERE status = 'dat')::BIGINT AS dat_count,                                        
         (SELECT COUNT(*) FROM category_status WHERE status = 'thieu')::BIGINT AS thieu_count,                                    
         (SELECT COUNT(*) FROM category_status WHERE status = 'vuot')::BIGINT AS vuot_count,                                      
         (SELECT COUNT(*) FROM thiet_bi WHERE don_vi = p_don_vi AND nhom_thiet_bi_id IS NULL)::BIGINT AS unassigned_equipment;    
     END;                                                                                                                         
     $$;                                                                                                                          
                                                                                                                                  
     GRANT EXECUTE ON FUNCTION public.dinh_muc_compliance_summary TO authenticated;                                               
     ```                                                                                                                          
                                                                                                                                  
     **Step 2: Apply migration**                                                                                                  
                                                                                                                                  
     Run: `mcp__supabase__apply_migration` with name `20260131_device_quota_rpc_mapping`                                          
                                                                                                                                  
     **Step 3: Commit**                                                                                                           
                                                                                                                                  
     ```bash                                                                                                                      
     git add supabase/migrations/20260131_device_quota_rpc_mapping.sql                                                            
     git commit -m "feat(db): add RPC functions for category tree and equipment mapping"                                          
     ```                                                                                                                          
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ### Task 1.4: Add RPC functions to API whitelist                                                                             
                                                                                                                                  
     **Files:**                                                                                                                   
     - Modify: `src/app/api/rpc/[fn]/route.ts`                                                                                    
                                                                                                                                  
     **Step 1: Add device quota functions to ALLOWED_FUNCTIONS**                                                                  
                                                                                                                                  
     Add these entries to the `ALLOWED_FUNCTIONS` Set:                                                                            
                                                                                                                                  
     ```typescript                                                                                                                
     // Device Quota                                                                                                              
     'dinh_muc_quyet_dinh_list',                                                                                                  
     'dinh_muc_quyet_dinh_create',                                                                                                
     'dinh_muc_quyet_dinh_update',                                                                                                
     'dinh_muc_quyet_dinh_activate',                                                                                              
     'dinh_muc_quyet_dinh_delete',                                                                                                
     'dinh_muc_nhom_list',                                                                                                        
     'dinh_muc_nhom_upsert',                                                                                                      
     'dinh_muc_thiet_bi_link',                                                                                                    
     'dinh_muc_thiet_bi_unlink',                                                                                                  
     'dinh_muc_thiet_bi_unassigned',                                                                                              
     'dinh_muc_thiet_bi_by_nhom',                                                                                                 
     'dinh_muc_compliance_summary',                                                                                               
     ```                                                                                                                          
                                                                                                                                  
     **Step 2: Commit**                                                                                                           
                                                                                                                                  
     ```bash                                                                                                                      
     git add src/app/api/rpc/[fn]/route.ts                                                                                        
     git commit -m "feat(api): whitelist device quota RPC functions"                                                              
     ```                                                                                                                          
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ## Phase 2: TypeScript Types & Hooks                                                                                         
                                                                                                                                  
     ### Task 2.1: Create TypeScript types                                                                                        
                                                                                                                                  
     **Files:**                                                                                                                   
     - Create: `src/app/(app)/device-quota/types.ts`                                                                              
                                                                                                                                  
     **Step 1: Write the types**                                                                                                  
                                                                                                                                  
     ```typescript                                                                                                                
     // ============================================                                                                              
     // Device Quota Types                                                                                                        
     // ============================================                                                                              
                                                                                                                                  
     export type DecisionStatus = 'draft' | 'active' | 'expired' | 'replaced'                                                     
     export type ComplianceStatus = 'dat' | 'thieu' | 'vuot'                                                                      
                                                                                                                                  
     // Quota Decision                                                                                                            
     export interface QuyetDinhDinhMuc {                                                                                          
       id: number                                                                                                                 
       don_vi_id: number                                                                                                          
       so_quyet_dinh: string                                                                                                      
       ngay_ban_hanh: string                                                                                                      
       ngay_hieu_luc: string                                                                                                      
       ngay_het_hieu_luc: string | null                                                                                           
       nguoi_ky: string                                                                                                           
       chuc_vu_nguoi_ky: string                                                                                                   
       trang_thai: DecisionStatus                                                                                                 
       ghi_chu: string | null                                                                                                     
       thay_the_cho_id: number | null                                                                                             
       created_at: string                                                                                                         
       updated_at: string                                                                                                         
       total_categories?: number                                                                                                  
       total_equipment_mapped?: number                                                                                            
     }                                                                                                                            
                                                                                                                                  
     export interface CreateDecisionInput {                                                                                       
       so_quyet_dinh: string                                                                                                      
       ngay_ban_hanh: string                                                                                                      
       ngay_hieu_luc: string                                                                                                      
       ngay_het_hieu_luc?: string | null                                                                                          
       nguoi_ky: string                                                                                                           
       chuc_vu_nguoi_ky: string                                                                                                   
       ghi_chu?: string | null                                                                                                    
     }                                                                                                                            
                                                                                                                                  
     export interface UpdateDecisionInput extends Partial<CreateDecisionInput> {                                                  
       id: number                                                                                                                 
     }                                                                                                                            
                                                                                                                                  
     // Quota Category (Tree Node)                                                                                                
     export interface NhomThietBiDinhMuc {                                                                                        
       id: number                                                                                                                 
       quyet_dinh_id: number                                                                                                      
       parent_id: number | null                                                                                                   
       ma_nhom: string                                                                                                            
       ten_nhom: string                                                                                                           
       phan_loai: 'A' | 'B' | null                                                                                                
       don_vi_tinh: string | null                                                                                                 
       so_luong_dinh_muc: number | null                                                                                           
       so_luong_toi_thieu: number | null                                                                                          
       thu_tu: number                                                                                                             
       ghi_chu: string | null                                                                                                     
       keywords: string[] | null                                                                                                  
       level: number                                                                                                              
       so_luong_hien_co: number                                                                                                   
     }                                                                                                                            
                                                                                                                                  
     export interface CategoryTreeNode extends NhomThietBiDinhMuc {                                                               
       children: CategoryTreeNode[]                                                                                               
       compliance_status: ComplianceStatus                                                                                        
       is_expanded?: boolean                                                                                                      
     }                                                                                                                            
                                                                                                                                  
     export interface UpsertCategoryInput {                                                                                       
       id?: number                                                                                                                
       quyet_dinh_id: number                                                                                                      
       parent_id?: number | null                                                                                                  
       ma_nhom: string                                                                                                            
       ten_nhom: string                                                                                                           
       phan_loai?: 'A' | 'B' | null                                                                                               
       don_vi_tinh?: string | null                                                                                                
       so_luong_dinh_muc?: number | null                                                                                          
       so_luong_toi_thieu?: number | null                                                                                         
       thu_tu?: number                                                                                                            
       ghi_chu?: string | null                                                                                                    
       keywords?: string[] | null                                                                                                 
     }                                                                                                                            
                                                                                                                                  
     // Equipment (simplified for mapping)                                                                                        
     export interface EquipmentForMapping {                                                                                       
       id: number                                                                                                                 
       ma_thiet_bi: string                                                                                                        
       ten_thiet_bi: string                                                                                                       
       model: string | null                                                                                                       
       serial: string | null                                                                                                      
       hang_san_xuat: string | null                                                                                               
       khoa_phong_quan_ly: string | null                                                                                          
       tinh_trang: string | null                                                                                                  
     }                                                                                                                            
                                                                                                                                  
     // AI Suggestion                                                                                                             
     export interface AISuggestion {                                                                                              
       category_id: number                                                                                                        
       category_name: string                                                                                                      
       confidence: number                                                                                                         
       reason: string                                                                                                             
     }                                                                                                                            
                                                                                                                                  
     // Compliance Summary                                                                                                        
     export interface ComplianceSummary {                                                                                         
       total_categories: number                                                                                                   
       dat_count: number                                                                                                          
       thieu_count: number                                                                                                        
       vuot_count: number                                                                                                         
       unassigned_equipment: number                                                                                               
     }                                                                                                                            
                                                                                                                                  
     // Dialog State                                                                                                              
     export interface DeviceQuotaDialogState {                                                                                    
       isCreateDecisionOpen: boolean                                                                                              
       isEditDecisionOpen: boolean                                                                                                
       isImportExcelOpen: boolean                                                                                                 
       isCreateCategoryOpen: boolean                                                                                              
       isEditCategoryOpen: boolean                                                                                                
       isConfirmLinkOpen: boolean                                                                                                 
       isConfirmUnlinkOpen: boolean                                                                                               
       editingDecision: QuyetDinhDinhMuc | null                                                                                   
       editingCategory: NhomThietBiDinhMuc | null                                                                                 
       selectedEquipmentIds: number[]                                                                                             
       selectedCategoryId: number | null                                                                                          
     }                                                                                                                            
                                                                                                                                  
     // Session User (from existing types)                                                                                        
     export interface SessionUser {                                                                                               
       id: string | number                                                                                                        
       role: string                                                                                                               
       khoa_phong: string | null                                                                                                  
       username?: string                                                                                                          
       don_vi?: number | string                                                                                                   
       dia_ban_id?: number                                                                                                        
       full_name?: string                                                                                                         
     }                                                                                                                            
     ```                                                                                                                          
                                                                                                                                  
     **Step 2: Commit**                                                                                                           
                                                                                                                                  
     ```bash                                                                                                                      
     git add src/app/(app)/device-quota/types.ts                                                                                  
     git commit -m "feat(types): add device quota TypeScript interfaces"                                                          
     ```                                                                                                                          
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ### Task 2.2: Create TanStack Query hooks                                                                                    
                                                                                                                                  
     **Files:**                                                                                                                   
     - Create: `src/app/(app)/device-quota/_hooks/useDeviceQuota.ts`                                                              
                                                                                                                                  
     **Step 1: Write the hooks**                                                                                                  
                                                                                                                                  
     ```typescript                                                                                                                
     import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'                                                
     import { callRpc } from '@/lib/rpc-client'                                                                                   
     import type {                                                                                                                
       QuyetDinhDinhMuc,                                                                                                          
       NhomThietBiDinhMuc,                                                                                                        
       EquipmentForMapping,                                                                                                       
       ComplianceSummary,                                                                                                         
       CreateDecisionInput,                                                                                                       
       UpdateDecisionInput,                                                                                                       
       UpsertCategoryInput,                                                                                                       
     } from '../types'                                                                                                            
                                                                                                                                  
     // ============================================                                                                              
     // Query Keys                                                                                                                
     // ============================================                                                                              
                                                                                                                                  
     export const deviceQuotaKeys = {                                                                                             
       all: ['device-quota'] as const,                                                                                            
       decisions: (donViId?: number) => [...deviceQuotaKeys.all, 'decisions', donViId] as const,                                  
       decision: (id: number) => [...deviceQuotaKeys.all, 'decision', id] as const,                                               
       categories: (quyetDinhId: number) => [...deviceQuotaKeys.all, 'categories', quyetDinhId] as const,                         
       unassigned: (donViId?: number, search?: string) => [...deviceQuotaKeys.all, 'unassigned', donViId, search] as const,       
       equipmentByCategory: (nhomId: number) => [...deviceQuotaKeys.all, 'equipment', nhomId] as const,                           
       compliance: (quyetDinhId: number) => [...deviceQuotaKeys.all, 'compliance', quyetDinhId] as const,                         
     }                                                                                                                            
                                                                                                                                  
     // ============================================                                                                              
     // Decision Queries                                                                                                          
     // ============================================                                                                              
                                                                                                                                  
     export function useDecisionList(donViId?: number, trangThai?: string) {                                                      
       return useQuery({                                                                                                          
         queryKey: deviceQuotaKeys.decisions(donViId),                                                                            
         queryFn: () => callRpc<QuyetDinhDinhMuc[]>({                                                                             
           fn: 'dinh_muc_quyet_dinh_list',                                                                                        
           args: { p_trang_thai: trangThai }                                                                                      
         }),                                                                                                                      
         enabled: !!donViId,                                                                                                      
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     export function useActiveDecision(donViId?: number) {                                                                        
       return useQuery({                                                                                                          
         queryKey: [...deviceQuotaKeys.decisions(donViId), 'active'],                                                             
         queryFn: async () => {                                                                                                   
           const decisions = await callRpc<QuyetDinhDinhMuc[]>({                                                                  
             fn: 'dinh_muc_quyet_dinh_list',                                                                                      
             args: { p_trang_thai: 'active' }                                                                                     
           })                                                                                                                     
           return decisions[0] ?? null                                                                                            
         },                                                                                                                       
         enabled: !!donViId,                                                                                                      
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     // ============================================                                                                              
     // Decision Mutations                                                                                                        
     // ============================================                                                                              
                                                                                                                                  
     export function useCreateDecision() {                                                                                        
       const queryClient = useQueryClient()                                                                                       
                                                                                                                                  
       return useMutation({                                                                                                       
         mutationFn: (data: CreateDecisionInput) => callRpc<number>({                                                             
           fn: 'dinh_muc_quyet_dinh_create',                                                                                      
           args: {                                                                                                                
             p_so_quyet_dinh: data.so_quyet_dinh,                                                                                 
             p_ngay_ban_hanh: data.ngay_ban_hanh,                                                                                 
             p_ngay_hieu_luc: data.ngay_hieu_luc,                                                                                 
             p_ngay_het_hieu_luc: data.ngay_het_hieu_luc,                                                                         
             p_nguoi_ky: data.nguoi_ky,                                                                                           
             p_chuc_vu_nguoi_ky: data.chuc_vu_nguoi_ky,                                                                           
             p_ghi_chu: data.ghi_chu,                                                                                             
           }                                                                                                                      
         }),                                                                                                                      
         onSuccess: () => {                                                                                                       
           queryClient.invalidateQueries({ queryKey: deviceQuotaKeys.all })                                                       
         },                                                                                                                       
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     export function useUpdateDecision() {                                                                                        
       const queryClient = useQueryClient()                                                                                       
                                                                                                                                  
       return useMutation({                                                                                                       
         mutationFn: (data: UpdateDecisionInput) => callRpc<boolean>({                                                            
           fn: 'dinh_muc_quyet_dinh_update',                                                                                      
           args: {                                                                                                                
             p_id: data.id,                                                                                                       
             p_so_quyet_dinh: data.so_quyet_dinh,                                                                                 
             p_ngay_ban_hanh: data.ngay_ban_hanh,                                                                                 
             p_ngay_hieu_luc: data.ngay_hieu_luc,                                                                                 
             p_ngay_het_hieu_luc: data.ngay_het_hieu_luc,                                                                         
             p_nguoi_ky: data.nguoi_ky,                                                                                           
             p_chuc_vu_nguoi_ky: data.chuc_vu_nguoi_ky,                                                                           
             p_ghi_chu: data.ghi_chu,                                                                                             
           }                                                                                                                      
         }),                                                                                                                      
         onSuccess: () => {                                                                                                       
           queryClient.invalidateQueries({ queryKey: deviceQuotaKeys.all })                                                       
         },                                                                                                                       
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     export function useActivateDecision() {                                                                                      
       const queryClient = useQueryClient()                                                                                       
                                                                                                                                  
       return useMutation({                                                                                                       
         mutationFn: (id: number) => callRpc<boolean>({                                                                           
           fn: 'dinh_muc_quyet_dinh_activate',                                                                                    
           args: { p_id: id }                                                                                                     
         }),                                                                                                                      
         onSuccess: () => {                                                                                                       
           queryClient.invalidateQueries({ queryKey: deviceQuotaKeys.all })                                                       
         },                                                                                                                       
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     export function useDeleteDecision() {                                                                                        
       const queryClient = useQueryClient()                                                                                       
                                                                                                                                  
       return useMutation({                                                                                                       
         mutationFn: (id: number) => callRpc<boolean>({                                                                           
           fn: 'dinh_muc_quyet_dinh_delete',                                                                                      
           args: { p_id: id }                                                                                                     
         }),                                                                                                                      
         onSuccess: () => {                                                                                                       
           queryClient.invalidateQueries({ queryKey: deviceQuotaKeys.all })                                                       
         },                                                                                                                       
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     // ============================================                                                                              
     // Category Queries                                                                                                          
     // ============================================                                                                              
                                                                                                                                  
     export function useCategoryList(quyetDinhId: number | null) {                                                                
       return useQuery({                                                                                                          
         queryKey: deviceQuotaKeys.categories(quyetDinhId!),                                                                      
         queryFn: () => callRpc<NhomThietBiDinhMuc[]>({                                                                           
           fn: 'dinh_muc_nhom_list',                                                                                              
           args: { p_quyet_dinh_id: quyetDinhId }                                                                                 
         }),                                                                                                                      
         enabled: !!quyetDinhId,                                                                                                  
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     export function useUpsertCategory() {                                                                                        
       const queryClient = useQueryClient()                                                                                       
                                                                                                                                  
       return useMutation({                                                                                                       
         mutationFn: (data: UpsertCategoryInput) => callRpc<number>({                                                             
           fn: 'dinh_muc_nhom_upsert',                                                                                            
           args: {                                                                                                                
             p_id: data.id,                                                                                                       
             p_quyet_dinh_id: data.quyet_dinh_id,                                                                                 
             p_parent_id: data.parent_id,                                                                                         
             p_ma_nhom: data.ma_nhom,                                                                                             
             p_ten_nhom: data.ten_nhom,                                                                                           
             p_phan_loai: data.phan_loai,                                                                                         
             p_don_vi_tinh: data.don_vi_tinh,                                                                                     
             p_so_luong_dinh_muc: data.so_luong_dinh_muc,                                                                         
             p_so_luong_toi_thieu: data.so_luong_toi_thieu,                                                                       
             p_thu_tu: data.thu_tu,                                                                                               
             p_ghi_chu: data.ghi_chu,                                                                                             
             p_keywords: data.keywords,                                                                                           
           }                                                                                                                      
         }),                                                                                                                      
         onSuccess: (_, variables) => {                                                                                           
           queryClient.invalidateQueries({                                                                                        
             queryKey: deviceQuotaKeys.categories(variables.quyet_dinh_id)                                                        
           })                                                                                                                     
         },                                                                                                                       
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     // ============================================                                                                              
     // Equipment Mapping Queries & Mutations                                                                                     
     // ============================================                                                                              
                                                                                                                                  
     export function useUnassignedEquipment(search?: string) {                                                                    
       return useQuery({                                                                                                          
         queryKey: deviceQuotaKeys.unassigned(undefined, search),                                                                 
         queryFn: () => callRpc<EquipmentForMapping[]>({                                                                          
           fn: 'dinh_muc_thiet_bi_unassigned',                                                                                    
           args: { p_search: search || null, p_limit: 100 }                                                                       
         }),                                                                                                                      
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     export function useEquipmentByCategory(nhomId: number | null) {                                                              
       return useQuery({                                                                                                          
         queryKey: deviceQuotaKeys.equipmentByCategory(nhomId!),                                                                  
         queryFn: () => callRpc<EquipmentForMapping[]>({                                                                          
           fn: 'dinh_muc_thiet_bi_by_nhom',                                                                                       
           args: { p_nhom_id: nhomId }                                                                                            
         }),                                                                                                                      
         enabled: !!nhomId,                                                                                                       
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     export function useLinkEquipment() {                                                                                         
       const queryClient = useQueryClient()                                                                                       
                                                                                                                                  
       return useMutation({                                                                                                       
         mutationFn: ({ thietBiIds, nhomId }: { thietBiIds: number[], nhomId: number }) =>                                        
           callRpc<number>({                                                                                                      
             fn: 'dinh_muc_thiet_bi_link',                                                                                        
             args: { p_thiet_bi_ids: thietBiIds, p_nhom_id: nhomId }                                                              
           }),                                                                                                                    
         onSuccess: () => {                                                                                                       
           queryClient.invalidateQueries({ queryKey: deviceQuotaKeys.all })                                                       
         },                                                                                                                       
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     export function useUnlinkEquipment() {                                                                                       
       const queryClient = useQueryClient()                                                                                       
                                                                                                                                  
       return useMutation({                                                                                                       
         mutationFn: (thietBiIds: number[]) => callRpc<number>({                                                                  
           fn: 'dinh_muc_thiet_bi_unlink',                                                                                        
           args: { p_thiet_bi_ids: thietBiIds }                                                                                   
         }),                                                                                                                      
         onSuccess: () => {                                                                                                       
           queryClient.invalidateQueries({ queryKey: deviceQuotaKeys.all })                                                       
         },                                                                                                                       
       })                                                                                                                         
     }                                                                                                                            
                                                                                                                                  
     // ============================================                                                                              
     // Compliance Summary                                                                                                        
     // ============================================                                                                              
                                                                                                                                  
     export function useComplianceSummary(quyetDinhId: number | null) {                                                           
       return useQuery({                                                                                                          
         queryKey: deviceQuotaKeys.compliance(quyetDinhId!),                                                                      
         queryFn: () => callRpc<ComplianceSummary[]>({                                                                            
           fn: 'dinh_muc_compliance_summary',                                                                                     
           args: { p_quyet_dinh_id: quyetDinhId }                                                                                 
         }).then(rows => rows[0] ?? null),                                                                                        
         enabled: !!quyetDinhId,                                                                                                  
       })                                                                                                                         
     }                                                                                                                            
     ```                                                                                                                          
                                                                                                                                  
     **Step 2: Commit**                                                                                                           
                                                                                                                                  
     ```bash                                                                                                                      
     git add src/app/(app)/device-quota/_hooks/useDeviceQuota.ts                                                                  
     git commit -m "feat(hooks): add TanStack Query hooks for device quota"                                                       
     ```                                                                                                                          
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ## Phase 3: UI Components                                                                                                    
                                                                                                                                  
     ### Task 3.1: Create page structure and context                                                                              
                                                                                                                                  
     **Files:**                                                                                                                   
     - Create: `src/app/(app)/device-quota/page.tsx`                                                                              
     - Create: `src/app/(app)/device-quota/mapping/page.tsx`                                                                      
     - Create: `src/app/(app)/device-quota/decisions/page.tsx`                                                                    
     - Create: `src/app/(app)/device-quota/_components/DeviceQuotaContext.tsx`                                                    
     - Create: `src/app/(app)/device-quota/_hooks/useDeviceQuotaContext.ts`                                                       
                                                                                                                                  
     See implementation details in separate task files due to length.                                                             
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ### Task 3.2: Create AI suggestion API route                                                                                 
                                                                                                                                  
     **Files:**                                                                                                                   
     - Create: `src/app/api/ai/suggest-category/route.ts`                                                                         
                                                                                                                                  
     **Step 1: Write the API route**                                                                                              
                                                                                                                                  
     ```typescript                                                                                                                
     import { NextRequest, NextResponse } from 'next/server'                                                                      
     import { getServerSession } from 'next-auth'                                                                                 
     import { authOptions } from '@/auth/config'                                                                                  
     import { GoogleGenerativeAI } from '@google/generative-ai'                                                                   
                                                                                                                                  
     export const runtime = 'nodejs'                                                                                              
                                                                                                                                  
     const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')                                                       
                                                                                                                                  
     export async function POST(req: NextRequest) {                                                                               
       try {                                                                                                                      
         const session = await getServerSession(authOptions)                                                                      
         if (!session?.user) {                                                                                                    
           return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })                                                   
         }                                                                                                                        
                                                                                                                                  
         // Check role                                                                                                            
         const role = (session.user as any).role                                                                                  
         if (!['global', 'admin', 'to_qltb'].includes(role)) {                                                                    
           return NextResponse.json({ error: 'Forbidden' }, { status: 403 })                                                      
         }                                                                                                                        
                                                                                                                                  
         const body = await req.json()                                                                                            
         const { equipment, categories } = body                                                                                   
                                                                                                                                  
         if (!equipment || !categories) {                                                                                         
           return NextResponse.json({ error: 'Missing equipment or categories' }, { status: 400 })                                
         }                                                                                                                        
                                                                                                                                  
         const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })                                                    
                                                                                                                                  
         const prompt = `Bạn là chuyên gia phân loại thiết bị y tế theo Thông tư 08/2019/TT-BYT của Bộ Y tế Việt Nam.             
                                                                                                                                  
     Thiết bị cần phân loại:                                                                                                      
     - Tên: ${equipment.ten_thiet_bi}                                                                                             
     - Model: ${equipment.model || 'N/A'}                                                                                         
     - Hãng sản xuất: ${equipment.hang_san_xuat || 'N/A'}                                                                         
     - Khoa sử dụng: ${equipment.khoa_phong_quan_ly || 'N/A'}                                                                     
                                                                                                                                  
     Danh mục định mức hiện có:                                                                                                   
     ${categories.map((c: any) => `- ID ${c.id}: ${c.ten_nhom} (${c.phan_loai || 'Chung'})`).join('\n')}                          
                                                                                                                                  
     Hãy phân loại thiết bị này vào một trong các danh mục trên. Trả về JSON với format chính xác:                                
     {"category_id": <number>, "confidence": <0-100>, "reason": "<lý do ngắn gọn bằng tiếng Việt>"}                               
                                                                                                                                  
     Chỉ trả về JSON, không có text khác.`                                                                                        
                                                                                                                                  
         const result = await model.generateContent(prompt)                                                                       
         const responseText = result.response.text().trim()                                                                       
                                                                                                                                  
         // Parse JSON from response                                                                                              
         const jsonMatch = responseText.match(/\{[\s\S]*\}/)                                                                      
         if (!jsonMatch) {                                                                                                        
           return NextResponse.json({                                                                                             
             error: 'Failed to parse AI response',                                                                                
             raw: responseText                                                                                                    
           }, { status: 500 })                                                                                                    
         }                                                                                                                        
                                                                                                                                  
         const suggestion = JSON.parse(jsonMatch[0])                                                                              
                                                                                                                                  
         // Find category name                                                                                                    
         const category = categories.find((c: any) => c.id === suggestion.category_id)                                            
                                                                                                                                  
         return NextResponse.json({                                                                                               
           category_id: suggestion.category_id,                                                                                   
           category_name: category?.ten_nhom || 'Unknown',                                                                        
           confidence: suggestion.confidence,                                                                                     
           reason: suggestion.reason,                                                                                             
         })                                                                                                                       
                                                                                                                                  
       } catch (error) {                                                                                                          
         console.error('AI suggestion error:', error)                                                                             
         return NextResponse.json({                                                                                               
           error: 'AI suggestion failed',                                                                                         
           details: error instanceof Error ? error.message : 'Unknown error'                                                      
         }, { status: 500 })                                                                                                      
       }                                                                                                                          
     }                                                                                                                            
     ```                                                                                                                          
                                                                                                                                  
     **Step 2: Add GEMINI_API_KEY to environment**                                                                                
                                                                                                                                  
     Ensure `.env.local` has: `GEMINI_API_KEY=your_api_key_here`                                                                  
                                                                                                                                  
     **Step 3: Commit**                                                                                                           
                                                                                                                                  
     ```bash                                                                                                                      
     git add src/app/api/ai/suggest-category/route.ts                                                                             
     git commit -m "feat(api): add Gemini-powered category suggestion endpoint"                                                   
     ```                                                                                                                          
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ### Task 3.3: Create navigation menu entry                                                                                   
                                                                                                                                  
     **Files:**                                                                                                                   
     - Modify: `src/components/app-sidebar.tsx` (or equivalent nav file)                                                          
                                                                                                                                  
     **Step 1: Add menu entry**                                                                                                   
                                                                                                                                  
     Add to the navigation items array:                                                                                           
                                                                                                                                  
     ```typescript                                                                                                                
     {                                                                                                                            
       title: 'Định mức',                                                                                                         
       icon: ClipboardList, // from lucide-react                                                                                  
       items: [                                                                                                                   
         { title: 'Tổng quan', href: '/device-quota' },                                                                           
         { title: 'Ánh xạ thiết bị', href: '/device-quota/mapping' },                                                             
         { title: 'Quyết định', href: '/device-quota/decisions' },                                                                
       ],                                                                                                                         
     }                                                                                                                            
     ```                                                                                                                          
                                                                                                                                  
     **Step 2: Commit**                                                                                                           
                                                                                                                                  
     ```bash                                                                                                                      
     git add src/components/app-sidebar.tsx                                                                                       
     git commit -m "feat(nav): add device quota menu section"                                                                     
     ```                                                                                                                          
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ## Phase 4: Component Implementation                                                                                         
                                                                                                                                  
     Due to the complexity of the UI components, these are broken into separate implementation tasks:                             
                                                                                                                                  
     ### Task 4.1: DeviceQuotaContext and Provider (~300 lines)                                                                   
     ### Task 4.2: DeviceQuotaMappingPage - Split screen layout (~250 lines)                                                      
     ### Task 4.3: DeviceQuotaCategoryTree - Left panel tree (~350 lines)                                                         
     ### Task 4.4: DeviceQuotaUnassignedList - Right panel list (~200 lines)                                                      
     ### Task 4.5: DeviceQuotaDecisionSelector - Dropdown with create (~150 lines)                                                
     ### Task 4.6: DeviceQuotaCreateDecisionDialog (~200 lines)                                                                   
     ### Task 4.7: DeviceQuotaLinkConfirmDialog (~100 lines)                                                                      
     ### Task 4.8: DeviceQuotaComplianceReport - HTML printable (~300 lines)                                                      
     ### Task 4.9: DeviceQuotaDashboard - Overview page (~200 lines)                                                              
     ### Task 4.10: DeviceQuotaDecisionsPage - List/manage decisions (~250 lines)                                                 
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ## Phase 5: Testing                                                                                                          
                                                                                                                                  
     ### Task 5.1: Test RPC functions with SQL                                                                                    
                                                                                                                                  
     **Files:**                                                                                                                   
     - Create: `supabase/tests/device_quota_test.sql`                                                                             
                                                                                                                                  
     ### Task 5.2: Test React components                                                                                          
                                                                                                                                  
     **Files:**                                                                                                                   
     - Create: `src/app/(app)/device-quota/__tests__/DeviceQuotaContext.test.tsx`                                                 
     - Create: `src/app/(app)/device-quota/__tests__/useDeviceQuota.test.ts`                                                      
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ## Phase 6: Final Integration                                                                                                
                                                                                                                                  
     ### Task 6.1: Run typecheck and lint                                                                                         
                                                                                                                                  
     ```bash                                                                                                                      
     node scripts/npm-run.js run typecheck                                                                                        
     node scripts/npm-run.js run lint                                                                                             
     ```                                                                                                                          
                                                                                                                                  
     ### Task 6.2: Manual testing checklist                                                                                       
                                                                                                                                  
     - [ ] Create new quota decision                                                                                              
     - [ ] Import categories from Excel                                                                                           
     - [ ] View category tree with counts                                                                                         
     - [ ] Link equipment to category (single)                                                                                    
     - [ ] Link equipment to category (bulk)                                                                                      
     - [ ] Unlink equipment from category                                                                                         
     - [ ] AI suggestion works                                                                                                    
     - [ ] Print HTML compliance report                                                                                           
     - [ ] Role-based permissions work                                                                                            
     - [ ] Mobile responsive                                                                                                      
                                                                                                                                  
     ### Task 6.3: Create PR                                                                                                      
                                                                                                                                  
     ```bash                                                                                                                      
     git push -u origin feat/device-quota                                                                                         
     gh pr create --title "feat(device-quota): add quota mapping interface" --body "..."                                          
     ```                                                                                                                          
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     ## Summary                                                                                                                   
                                                                                                                                  
     | Phase | Tasks | Estimated Effort |                                                                                         
     |-------|-------|------------------|                                                                                         
     | Phase 1: Database | 4 tasks | Schema + 12 RPC functions |                                                                  
     | Phase 2: Types/Hooks | 2 tasks | TypeScript + TanStack Query |                                                             
     | Phase 3: UI Structure | 3 tasks | Pages, Context, AI API |                                                                 
     | Phase 4: Components | 10 tasks | All UI components |                                                                       
     | Phase 5: Testing | 2 tasks | SQL + React tests |                                                                           
     | Phase 6: Integration | 3 tasks | Typecheck, QA, PR |                                                                       
                                                                                                                                  
     **Total: 24 tasks**                                                                                                          
                                                                                                                                  
     ---                                                                                                                          
                                                                                                                                  
     **Plan complete and saved to `docs/plans/2026-01-31-device-quota-mapping.md`.**                                              
                                                                                                                                  
     Two execution options:                                                                                                       
                                                                                                                                  
     **1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration             
                                                                                                                                  
     **2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints                 
                                                                                                                                  
     Which approach?