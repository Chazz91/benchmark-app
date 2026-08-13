'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface CategoryState {
  score: number;
  comments: string;
}

const CATEGORIES: { key: string; label: string; description: string }[] = [
  {
    key: 'safety',
    label: 'Safety Awareness',
    description:
      "Following ERP's, Company Procedures, Mentoring, Involvement with crews / services and maintaining a positive & safe working environment",
  },
  {
    key: 'knowledge',
    label: 'Industry Related Knowledge',
    description: 'Experience, Versatility, Technical Aptitude, Problem Solving, Logistics and Services',
  },
  {
    key: 'reporting',
    label: 'Reporting & Paperwork',
    description:
      'Thorough, detailed, descriptive reports w/ proper spelling, punctuation & grammar, daily cost control and computer skills such as software knowledge and keyboarding',
  },
  {
    key: 'professionalism',
    label: 'Professionalism',
    description:
      'Organized, efficient, follows direction, team oriented, people skills, resolves problems effectively and overall strong company representation',
  },
  {
    key: 'overall',
    label: 'Overall',
    description: 'General rating for the Consultant',
  },
];

const RATING_LABELS = ['Poor', 'Acceptable', 'Satisfactory', 'Good', 'Excellent'];

export default function EvaluatePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [consultant, setConsultant] = useState<{ firstName: string; lastName: string; title: string | null } | null>(
    null
  );

  const [evaluatorName, setEvaluatorName] = useState('');
  const [evaluatorEmail, setEvaluatorEmail] = useState('');
  const [evaluatorCompany, setEvaluatorCompany] = useState('');
  const [directSupervisor, setDirectSupervisor] = useState('');
  const [evaluatorTitle, setEvaluatorTitle] = useState('');
  const [typeOfWork, setTypeOfWork] = useState('');
  const [lengthOfWork, setLengthOfWork] = useState('');

  const [categories, setCategories] = useState<Record<string, CategoryState>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.key, { score: 0, comments: '' }]))
  );

  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/evaluate/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.consultant) {
          setValid(true);
          setConsultant(d.consultant);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  function setCategoryScore(key: string, score: number) {
    setCategories((prev) => ({ ...prev, [key]: { ...prev[key], score } }));
  }

  function setCategoryComments(key: string, comments: string) {
    setCategories((prev) => ({ ...prev, [key]: { ...prev[key], comments } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const missing = CATEGORIES.find((c) => categories[c.key].score === 0);
    if (missing) {
      setError(`Please select a rating for "${missing.label}" before submitting.`);
      return;
    }

    setSubmitting(true);

    const res = await fetch(`/api/evaluate/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evaluatorName,
        evaluatorEmail,
        evaluatorCompany,
        directSupervisor,
        evaluatorTitle,
        typeOfWork,
        lengthOfWork,
        safetyScore: categories.safety.score,
        safetyComments: categories.safety.comments,
        knowledgeScore: categories.knowledge.score,
        knowledgeComments: categories.knowledge.comments,
        reportingScore: categories.reporting.score,
        reportingComments: categories.reporting.comments,
        professionalismScore: categories.professionalism.score,
        professionalismComments: categories.professionalism.comments,
        overallScore: categories.overall.score,
        overallComments: categories.overall.comments,
        wouldRecommend,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }
    setDone(true);
  }

  if (loading) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  if (!valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-red-700">Link not found</h1>
          <p className="text-sm text-slate-600">
            This evaluation link isn&apos;t valid. Please check the link you were sent.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-green-700">Thank you!</h1>
          <p className="text-sm text-slate-600">
            Thank you for taking the time to complete this evaluation. Your insight will be
            reviewed and shared with the consultant, in hopes of improving, motivating, and
            continuing their professional development.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-brand-900 underline">Consultant Evaluation</h1>
        <p className="mb-6 text-sm text-slate-500">
          Evaluating {consultant?.firstName} {consultant?.lastName}
          {consultant?.title ? ` — ${consultant.title}` : ''}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">O&amp;G Company</label>
              <input
                value={evaluatorCompany}
                onChange={(e) => setEvaluatorCompany(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Direct Supervisor</label>
              <input
                value={directSupervisor}
                onChange={(e) => setDirectSupervisor(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Your Title</label>
              <input
                value={evaluatorTitle}
                onChange={(e) => setEvaluatorTitle(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Type of Work</label>
              <input
                value={typeOfWork}
                onChange={(e) => setTypeOfWork(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Length of Work</label>
              <input
                value={lengthOfWork}
                onChange={(e) => setLengthOfWork(e.target.value)}
                placeholder="e.g. 6 months"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Your Name</label>
                <input
                  required
                  value={evaluatorName}
                  onChange={(e) => setEvaluatorName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Email (optional)</label>
                <input
                  type="email"
                  value={evaluatorEmail}
                  onChange={(e) => setEvaluatorEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <p className="text-xs italic text-slate-500">
            Please select one rating for each category and elaborate with any additional comments.
          </p>

          {/* Rated categories */}
          {CATEGORIES.map((cat) => (
            <div key={cat.key} className="border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-800">{cat.label}</p>
              <p className="mb-2 text-xs italic text-slate-500">{cat.description}</p>

              <div className="mb-2 grid grid-cols-5 gap-1">
                {RATING_LABELS.map((label, i) => {
                  const value = i + 1;
                  const selected = categories[cat.key].score === value;
                  return (
                    <button
                      type="button"
                      key={label}
                      onClick={() => setCategoryScore(cat.key, value)}
                      className={
                        selected
                          ? 'rounded-md border border-gold-500 bg-gold-500 py-2 text-xs font-medium text-brand-900'
                          : 'rounded-md border border-slate-300 py-2 text-xs text-slate-600 hover:border-gold-500'
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={categories[cat.key].comments}
                onChange={(e) => setCategoryComments(cat.key, e.target.value)}
                placeholder="Additional comments (optional)"
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          ))}

          {/* Recommend for hire */}
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-800">Would you recommend for hire?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                className={
                  wouldRecommend === true
                    ? 'rounded-md border border-green-600 bg-green-50 px-4 py-2 text-sm font-medium text-green-700'
                    : 'rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600'
                }
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                className={
                  wouldRecommend === false
                    ? 'rounded-md border border-red-600 bg-red-50 px-4 py-2 text-sm font-medium text-red-700'
                    : 'rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600'
                }
              >
                No
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gold-500 py-3 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Evaluation'}
          </button>
        </form>
      </div>
    </div>
  );
}