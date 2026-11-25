// Mirrors the server's calculateFundingShortfall (fundingCheck.service.js):
// the planned contribution is added only when it has not been transferred yet.
export function fundingShortfall(basis, { balanceCents, contributionDone }) {
  const pendingContributionCents = contributionDone ? 0 : basis.plannedContributionCents;
  const availableCents = balanceCents + pendingContributionCents;
  const neededCents = basis.pendingThisMonthCents + basis.overdueCents + basis.reserveForLaterCents;
  return {
    pendingContributionCents,
    availableCents,
    neededCents,
    shortfallCents: Math.max(0, neededCents - availableCents),
    surplusCents: Math.max(0, availableCents - neededCents),
  };
}

// Split by contribution percentage; the rounding remainder goes to the first people.
export function splitByContribution(amountCents, contributions) {
  const totalBps = contributions.reduce((sum, item) => sum + item.contributionBps, 0);
  if (!totalBps) return [];
  const shares = contributions.map((item) => ({
    personId: item.personId,
    personName: item.personName,
    amountCents: Math.floor((amountCents * item.contributionBps) / totalBps),
  }));
  let remainder = amountCents - shares.reduce((sum, item) => sum + item.amountCents, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % shares.length, remainder -= 1) {
    shares[index].amountCents += 1;
  }
  return shares;
}
