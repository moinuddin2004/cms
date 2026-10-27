/** Password strength indicator used by signup and password reset. */
export function PasswordStrength({ password }: { password: string }) {
  const getStrength = (
    pwd: string,
  ): { level: number; text: string; color: string } => {
    let score = 0
    if (pwd.length >= 6) score++
    if (pwd.length >= 8) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++

    if (score <= 1) return { level: 1, text: 'Weak', color: 'bg-danger' }
    if (score <= 2) return { level: 2, text: 'Fair', color: 'bg-amber' }
    if (score <= 3) return { level: 3, text: 'Good', color: 'bg-primary' }
    if (score <= 4) return { level: 4, text: 'Strong', color: 'bg-emerald' }
    return { level: 5, text: 'Very strong', color: 'bg-emerald' }
  }

  const strength = getStrength(password)

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= strength.level ? strength.color : 'bg-border'
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Password strength:{' '}
        <span className="font-medium text-foreground">{strength.text}</span>
      </p>
    </div>
  )
}
