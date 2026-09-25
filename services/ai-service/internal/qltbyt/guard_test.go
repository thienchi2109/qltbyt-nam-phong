package qltbyt

import (
	"errors"
	"strings"
	"testing"
)

func TestQueryGuardAcceptsReadOnlyStatements(t *testing.T) {
	valid, err := validateSQL(" select equipment_id from ai_readonly.equipment_search; ")
	if err != nil {
		t.Fatal(err)
	}
	if valid.Statement != "select equipment_id from ai_readonly.equipment_search" || valid.SQLShape != valid.Statement {
		t.Fatalf("validated = %+v", valid)
	}
	aliased, err := validateSQL("select equipment.equipment_id from ai_readonly.equipment_search equipment")
	if err != nil || !strings.Contains(aliased.Statement, "ai_readonly.equipment_search equipment") {
		t.Fatalf("alias = %+v %v", aliased, err)
	}
	with, err := validateSQL("with recent_repairs as (select equipment_id from ai_readonly.repair_facts limit 5) select equipment_id from recent_repairs")
	if err != nil || !strings.HasPrefix(strings.ToLower(with.Statement), "with recent_repairs as") {
		t.Fatalf("with = %+v %v", with, err)
	}
	literal, err := validateSQL("select 'contains E'' marker' as note from ai_readonly.equipment_search")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(literal.Statement, "contains E'' marker") {
		t.Fatalf("literal = %s", literal.Statement)
	}
	quoted, err := validateSQL(`select "equipment_id" from "ai_readonly"."equipment_search"`)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(quoted.Statement, `"ai_readonly"."equipment_search"`) {
		t.Fatalf("quoted = %s", quoted.Statement)
	}
	kept, err := validateSQL("select 'into temp public.set_config' as note from ai_readonly.equipment_search")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(kept.SQLShape, "into temp") {
		t.Fatalf("shape = %s", kept.SQLShape)
	}
}

func TestQueryGuardRejectsUnapprovedCatalog(t *testing.T) {
	cases := []string{
		"select id from ai_readonly.internal_view",
		`select id from "ai_readonly"."internal_view"`,
		"select id from internal_view",
		"select id from thiet_bi",
	}
	for _, sql := range cases {
		t.Run(sql, func(t *testing.T) {
			_, err := validateSQL(sql)
			var sqlErr *SQLError
			if !errors.As(err, &sqlErr) || sqlErr.Code != "unapproved_relation" {
				t.Fatalf("err = %v", err)
			}
		})
	}
}

func TestQueryGuardRejectsUnsafeStatements(t *testing.T) {
	cases := []struct {
		sql  string
		code string
	}{
		{sql: "select 1; select 2", code: "invalid_statement"},
		{sql: "select ';'; select 2", code: "invalid_statement"},
		{sql: "update ai_readonly.equipment_search set status = null", code: "invalid_statement"},
		{sql: "explain analyze select 1", code: "invalid_statement"},
		{sql: "copy ai_readonly.equipment_search to stdout", code: "invalid_statement"},
		{sql: "select id from public.thiet_bi", code: "forbidden_schema"},
		{sql: "select id from auth.users", code: "forbidden_schema"},
		{sql: "select id from some_other_schema.equipment", code: "forbidden_schema"},
		{sql: "select pg_catalog.set_config('app.current_facility_id', '2', true)", code: "forbidden_function"},
		{sql: "select 1 /* hidden update public.users */", code: "forbidden_keyword"},
		{sql: "select * from ai_readonly.equipment_search --'\nwhere set_config('app.current_facility_id', '2', true) is not null", code: "forbidden_function"},
		{sql: "with x as (delete from ai_readonly.equipment_search returning *) select * from x", code: "forbidden_keyword"},
		{sql: "select 1 where set_config('app.current_facility_id', '2', true) is not null", code: "forbidden_function"},
		{sql: "select $$'$$ || set_config('app.current_facility_id', '2', true)", code: "invalid_statement"},
		{sql: "select E'x\\'' from public.thiet_bi", code: "invalid_statement"},
		{sql: `select id from "public".thiet_bi`, code: "forbidden_schema"},
		{sql: `select "set_config"('app.current_facility_id', '2', true)`, code: "forbidden_function"},
		{sql: "select 1 into temp secret_table", code: "forbidden_keyword"},
		{sql: "select 1 into temporary secret_table", code: "forbidden_keyword"},
		{sql: "select 1 into unlogged secret_table", code: "forbidden_keyword"},
	}
	for _, test := range cases {
		t.Run(test.code+" "+test.sql, func(t *testing.T) {
			_, err := validateSQL(test.sql)
			var sqlErr *SQLError
			if !errors.As(err, &sqlErr) || sqlErr.Code != test.code {
				t.Fatalf("err = %v", err)
			}
		})
	}
}
