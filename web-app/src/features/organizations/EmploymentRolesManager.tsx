import { Link } from '@tanstack/react-router'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Roles moved to Settings → Roles (`/settings/roles`): permission bundles
 * per module, scopes, home page and members. This card only points there.
 */
export function EmploymentRolesManager() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> Employment roles
        </CardTitle>
        <CardDescription>
          Roles and their permissions are managed on the Roles screen of the
          clinic you have selected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to="/settings/roles">
            Open roles <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
