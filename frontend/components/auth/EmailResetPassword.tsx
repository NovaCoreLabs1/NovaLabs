'use client';

import { Button } from '@/components/ui/button';
import { forgotPasswordSchema } from '@/lib/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Info, Mail, Send } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import z from 'zod';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/Input';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import ResetPasswordCard from './ResetPasswordCard';
import Alert from '../ui/Alert';

interface EmailResetPasswordProps {
  onTogglePage: (value: 'email' | 'resend') => void;
}

const EmailResetPassword = ({ onTogglePage }: EmailResetPasswordProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  // Submits the email to the resend-reset-password-otp endpoint. The resend
  // route generates a fresh OTP, persists it, and emails the user — behaviorally
  // identical to the initial-request path used by `<ForgotPasswordForm>`. We
  // wire to resend intentionally so this form exercises the path that PR #1
  // fixed (previously the email-send inside that controller was commented out
  // and the user never received a code).
  async function onSubmit(values: z.infer<typeof forgotPasswordSchema>) {
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/resend-reset-password-otp', {
        email: values.email,
      });
      form.reset();
      onTogglePage('resend');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to send reset code.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ResetPasswordCard
        heading='Forgot Password'
        subHeading="No worries, we'll send you reset instructions"
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='w-full'>
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      icon={<Mail className='h-4 w-4 ' />}
                      placeholder='Enter your email address'
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              loading={isSubmitting}
              icon={<Send />}
              type='submit'
              className='w-full mt-4'
            >
              Send Reset Link
            </Button>
          </form>
        </Form>

        {/* Separator */}
        <div className='flex items-center self-start gap-3 w-full text-xs md:text-sm text-[#101828] mt-6'>
          <Separator className='flex-1' />
          <p>OR</p>
          <Separator className='flex-1' />
        </div>

        {/* Back to sign in */}
        <div className='flex items-center mt-6 gap-2 font-medium text-primary text-sm'>
          <ArrowLeft size={20} />
          <Link href='sign-in'>Back to Sign in</Link>
        </div>
      </ResetPasswordCard>

      {/* alert */}
      <Alert icon={<Info />} title='Need help?'>
        If you are having trouble accessing your account, contact our support
        team at{' '}
        <Link href='mailto:support@novalabs.com' className='underline'>
          support@novalabs.com
        </Link>
      </Alert>
    </>
  );
};

export default EmailResetPassword;
