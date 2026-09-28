import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PlannerPage from "./PlannerPage.jsx";

const { planTrip } = vi.hoisted(() => ({ planTrip: vi.fn() }));
vi.mock("../services/api.js", () => ({ api: { planTrip } }));

function renderPlanner() {
  return render(
    <MemoryRouter initialEntries={["/planner"]}>
      <Routes>
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/trips/:id" element={<p>Trip itinerary opened</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("trip planner flow", () => {
  beforeEach(() => planTrip.mockReset());

  it("lets a traveler choose preferences, submit a valid plan, and open the saved itinerary", async () => {
    const user = userEvent.setup();
    planTrip.mockResolvedValue({ trip: { id: "trip-123" }, warnings: [] });
    renderPlanner();

    await user.click(screen.getByRole("button", { name: "Crowds" }));
    expect(screen.getByRole("button", { name: "Crowds" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: /Remember these preferences/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: /Create my itinerary/ }));

    await waitFor(() => expect(planTrip).toHaveBeenCalledOnce());
    expect(planTrip).toHaveBeenCalledWith(expect.objectContaining({
      days: 4,
      dislikes: ["Crowds"],
      rememberPreferences: true,
    }));
    expect(await screen.findByText("Trip itinerary opened")).toBeInTheDocument();
  });

  it("shows an API validation error accessibly", async () => {
    planTrip.mockRejectedValue(new Error("Choose a trip length between 1 and 21 days."));
    renderPlanner();
    fireEvent.change(screen.getByLabelText("How long?"), { target: { value: "0" } });
    fireEvent.submit(screen.getByRole("button", { name: /Create my itinerary/ }).closest("form"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/1 and 21 days/);
  });
});
