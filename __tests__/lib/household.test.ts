import { afterEach, describe, expect, it } from 'vitest'
import { getHouseholdId, isHouseholdMember } from '@/lib/household'

const original = process.env.HOUSEHOLD_EMAILS
const session = (email?: string) => ({ user: { email }, expires: '' })

afterEach(() => {
  process.env.HOUSEHOLD_EMAILS = original
})

describe('household', () => {
  it('maps the owner to themselves', () => {
    process.env.HOUSEHOLD_EMAILS = 'owner@example.com,partner@example.com'
    expect(getHouseholdId(session('owner@example.com'))).toBe('owner@example.com')
  })

  it('maps the partner to the owner so both share data', () => {
    process.env.HOUSEHOLD_EMAILS = 'owner@example.com,partner@example.com'
    expect(getHouseholdId(session('partner@example.com'))).toBe('owner@example.com')
  })

  it('refuses anyone not listed', () => {
    process.env.HOUSEHOLD_EMAILS = 'owner@example.com,partner@example.com'
    expect(isHouseholdMember('stranger@example.com')).toBe(false)
    expect(getHouseholdId(session('stranger@example.com'))).toBeNull()
  })

  it('ignores whitespace and case in the env var and the email', () => {
    process.env.HOUSEHOLD_EMAILS = ' Owner@Example.com , PARTNER@example.com '
    expect(isHouseholdMember('partner@EXAMPLE.com')).toBe(true)
    expect(getHouseholdId(session('partner@example.com'))).toBe('owner@example.com')
  })

  it('fails closed when the env var is unset', () => {
    delete process.env.HOUSEHOLD_EMAILS
    expect(isHouseholdMember('owner@example.com')).toBe(false)
    expect(getHouseholdId(session('owner@example.com'))).toBeNull()
  })

  it('refuses a missing session or email', () => {
    process.env.HOUSEHOLD_EMAILS = 'owner@example.com'
    expect(getHouseholdId(null)).toBeNull()
    expect(getHouseholdId(session(undefined))).toBeNull()
  })
})
