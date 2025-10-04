"use client";

import * as React from "react";
import { Building2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FacilityOption } from "@/lib/equipment-utils";

interface TenantSelectorProps {
  facilities: FacilityOption[]; // Passed from parent - no API call needed!
  value: number | null; // null = "All Facilities"
  onChange: (facilityId: number | null) => void;
  disabled?: boolean;
  totalCount?: number; // Total equipment count for "All Facilities" display
}

export function TenantSelector({ 
  facilities, 
  value, 
  onChange, 
  disabled,
  totalCount 
}: TenantSelectorProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Don't show selector if user only has access to one facility
  if (facilities.length <= 1) {
    return null;
  }

  // Get selected facility for display
  const selectedFacility = React.useMemo(() => {
    if (value === null) return null;
    return facilities.find((f) => f.id === value);
  }, [value, facilities]);

  // Filter facilities based on search query
  const filteredFacilities = React.useMemo(() => {
    if (!searchQuery.trim()) return facilities;
    const query = searchQuery.toLowerCase();
    return facilities.filter((facility) =>
      facility.name.toLowerCase().includes(query)
    );
  }, [facilities, searchQuery]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectFacility = (facility: FacilityOption | null) => {
    if (facility === null) {
      onChange(null);
      setSearchQuery("");
    } else {
      onChange(facility.id);
      setSearchQuery(facility.name);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchQuery("");
    onChange(null);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  // Display value in input
  const displayValue = React.useMemo(() => {
    if (selectedFacility) return selectedFacility.name;
    if (searchQuery) return searchQuery;
    return "";
  }, [selectedFacility, searchQuery]);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Tìm cơ sở y tế..."
            value={displayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            disabled={disabled}
            className="pl-9 pr-10"
            autoComplete="off"
          />
          {(selectedFacility || searchQuery) && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {selectedFacility && (
          <Badge variant="secondary" className="shrink-0">
            {selectedFacility.count} TB
          </Badge>
        )}
        {value === null && !searchQuery && (
          <Badge variant="outline" className="shrink-0">
            {facilities.length} cơ sở • {totalCount || 0} TB
          </Badge>
        )}
      </div>

      {/* Dropdown suggestions */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[400px] overflow-y-auto">
          {/* "All Facilities" option */}
          <div
            className="px-3 py-2 text-sm cursor-pointer hover:bg-accent border-b"
            onClick={() => handleSelectFacility(null)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Tất cả cơ sở</span>
                {value === null && <Check className="h-4 w-4 text-primary" />}
              </div>
              <span className="text-xs text-muted-foreground">
                {facilities.length} cơ sở • {totalCount || 0} TB
              </span>
            </div>
          </div>

          {/* Filtered facilities */}
          <div className="p-1">
            {filteredFacilities.length > 0 ? (
              filteredFacilities.map((facility) => (
                <div
                  key={facility.id}
                  className="px-2 py-2 text-sm cursor-pointer hover:bg-accent rounded-sm"
                  onClick={() => handleSelectFacility(facility)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="truncate">{facility.name}</span>
                      {value === facility.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {facility.count} TB
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                Không tìm thấy cơ sở phù hợp
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}