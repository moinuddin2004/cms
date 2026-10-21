import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  MessageCircle,
  UserPlus,
  Star,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react'
import {
  useCommunications,
  useReferrals,
  useFeedback,
} from '../../hooks/usePatientSubEntities'
import type {
  Patient,
  PatientCommunication,
  PatientReferral,
  PatientFeedback,
} from '../../types'
import { CommunicationFormDialog } from './CommunicationFormDialog'

export function CrmTab({ patient }: { patient: Patient }) {
  const { data: communications = [], isLoading: loadingComms } =
    useCommunications(patient.id)
  const { data: referrals = [], isLoading: loadingReferrals } = useReferrals(
    patient.id,
  )
  const { data: feedbacks = [], isLoading: loadingFeedback } = useFeedback(
    patient.id,
  )

  return (
    <div className="space-y-6 mt-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Communication History */}
        <Card className="col-span-1 shadow-sm md:col-span-2">
          <CardHeader className="pb-2 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-md flex items-center gap-2">
                <MessageCircle className="text-brand-600" size={16} />
                Communication Logs
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                WhatsApp, SMS, Email, and Phone calls
              </CardDescription>
            </div>
            <CommunicationFormDialog patientId={patient.id} />
          </CardHeader>
          <CardContent className="pt-4">
            {loadingComms ? (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : communications.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center p-4">
                No communication history logged.
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {communications.map((comm) => (
                  <CommunicationRow key={comm.id} comm={comm} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referrals */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-md flex items-center gap-2">
              <UserPlus className="text-primary" size={16} />
              Referral Network
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Referred by: {patient.referredByText || 'None'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingReferrals ? (
              <div className="flex justify-center p-4">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center p-4">
                Patient hasn't referred anyone yet.
              </p>
            ) : (
              <div className="space-y-2">
                {referrals.map((ref) => (
                  <ReferralRow key={ref.id} referral={ref} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* NPS / Feedback */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-md flex items-center gap-2">
              <Star className="text-amber-500" size={16} />
              Patient Experience
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingFeedback ? (
              <div className="flex justify-center p-4">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : feedbacks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center p-4">
                No feedback collected yet.
              </p>
            ) : (
              <div className="space-y-3">
                {feedbacks.map((fb) => (
                  <FeedbackCard key={fb.id} feedback={fb} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CommunicationRow({ comm }: { comm: PatientCommunication }) {
  const directionIcon =
    comm.direction === 'outbound' ? (
      <ArrowUpRight size={12} className="text-blue-500" />
    ) : (
      <ArrowDownLeft size={12} className="text-green-500" />
    )

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    sent: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    read: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    completed: 'bg-green-100 text-green-700',
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        {directionIcon}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize">{comm.type}</span>
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5 capitalize"
            >
              {comm.purpose.replace('_', ' ')}
            </Badge>
          </div>
          {comm.subject && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {comm.subject}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className={`text-[10px] h-5 px-1.5 ${statusColor[comm.status] || ''}`}
        >
          {comm.status}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {comm.sentAt ? new Date(comm.sentAt).toLocaleDateString() : '—'}
        </span>
      </div>
    </div>
  )
}

function ReferralRow({ referral }: { referral: PatientReferral }) {
  const statusColor: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    contacted: 'bg-blue-100 text-blue-700',
    converted: 'bg-green-100 text-green-700',
    not_interested: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
      <div>
        <p className="text-sm font-medium">
          {referral.referredName || 'Unknown'}
        </p>
        <p className="text-xs text-muted-foreground">
          {referral.referredPhone || '—'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className={`text-[10px] h-5 px-1.5 ${statusColor[referral.status] || ''}`}
        >
          {referral.status.replace('_', ' ')}
        </Badge>
        {referral.rewardGiven && (
          <Badge
            variant="outline"
            className="text-[10px] h-5 px-1.5 bg-green-50 text-green-700"
          >
            Reward: Rs. {referral.rewardAmount?.toLocaleString()}
          </Badge>
        )}
      </div>
    </div>
  )
}

function FeedbackCard({ feedback }: { feedback: PatientFeedback }) {
  return (
    <div className="p-3 rounded-lg border space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={12}
                className={
                  i < feedback.rating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/30'
                }
              />
            ))}
          </div>
          <Badge
            variant="outline"
            className="text-[10px] h-5 px-1.5 capitalize"
          >
            {feedback.category.replace('_', ' ')}
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {new Date(feedback.createdAt).toLocaleDateString()}
        </span>
      </div>
      {feedback.feedbackText && (
        <p className="text-sm text-muted-foreground italic">
          "{feedback.feedbackText}"
        </p>
      )}
      {feedback.responseText && (
        <div className="bg-brand-50/50 p-2 rounded border border-brand-100 text-xs">
          <span className="font-semibold text-brand-700">Response:</span>{' '}
          {feedback.responseText}
        </div>
      )}
    </div>
  )
}
