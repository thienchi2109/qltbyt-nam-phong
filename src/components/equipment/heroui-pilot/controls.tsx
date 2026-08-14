/**
 * Pilot-only HeroUI button boundary for the Equipments toolbar slice.
 *
 * HeroUI must not be imported directly from feature files during the spike.
 * #684 should import only the controls it needs from this module.
 */

"use client"

import { Button } from "@heroui/react"

export { Button as EquipmentHeroButton }
