"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"

export function FormExample() {
  return (
    <div className="p-6">
      <FormBrandingHeader align="center" size="lg" showDivider />
      <div className="mt-8">
        <h1 className="text-2xl font-bold mb-4">Example Form with Tenant Branding</h1>
        <p className="mb-4">
          This is an example of how to use the FormBrandingHeader component in a React form.
        </p>
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Form Content</h2>
          <p>
            The tenant branding header above will display the current tenant's logo and name,
            with proper loading states and responsive design.
          </p>
        </div>
      </div>
    </div>
  )
}