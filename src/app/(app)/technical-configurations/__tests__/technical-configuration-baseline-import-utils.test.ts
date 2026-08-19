import { describe, expect, it } from "vitest"

import { getBaselineImportErrorMessage } from "../technical-configuration-baseline-import-utils"
import { TechnicalConfigurationRpcError } from "../technical-configuration-rpc"

describe("technical configuration baseline import errors", () => {
  it("directs cross-dossier workbooks to the authenticated copy workflow", () => {
    const error = new TechnicalConfigurationRpcError(422, {
      message: "template_mismatch",
      details: "template metadata does not match the target",
    })

    expect(getBaselineImportErrorMessage(error, "Không thể nhập workbook.")).toContain(
      "Sao chép từ hồ sơ khác"
    )
  })
})
