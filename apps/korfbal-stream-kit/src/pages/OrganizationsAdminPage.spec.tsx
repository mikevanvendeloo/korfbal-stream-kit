import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import OrganizationsAdminPage, {suggestSlug} from './OrganizationsAdminPage';
import {OrganizationGate} from '../components/OrganizationGate';
import {getOrganizationSlug, installOrganizationFetch} from '../lib/organization';
import type {Organization} from '../hooks/useOrganizations';
import {chooseOrganization, FORTUNA, KNKV, mockApi, renderPage, testOrganization} from '../test/organizations';

const OLD = testOrganization(3, 'Oud', {isActive: false});

function api(organizations = [FORTUNA, KNKV, OLD]) {
  return mockApi(({method, path, body}) => {
    if (path === '/api/organizations?all=true') return organizations;
    if (path === '/api/clubs') return [{id: 7, name: 'Fortuna/Ruitenheer', shortName: 'Fortuna', slug: 'fortuna'}];
    if (method === 'POST' && path === '/api/organizations') return testOrganization(4, (body as {name: string}).name);
    if (method === 'PUT') return {...organizations.find((o) => path.endsWith(`/${o.id}`)), ...(body as object)};
    return [];
  });
}

describe('OrganizationsAdminPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    chooseOrganization(null);
  });

  it('lists every organization with slug, club and status', async () => {
    api();
    renderPage(<OrganizationsAdminPage/>);
    const row = (await screen.findByText('Oud')).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Inactief');
    expect(within(row).getByRole('button', {name: 'Oud activeren'})).toBeEnabled();
    expect(screen.getByText('Fortuna').closest('tr')).toHaveTextContent('Actief');
  });

  it('creates an organization with a suggested slug and a club', async () => {
    const {calls} = api();
    renderPage(<OrganizationsAdminPage/>);
    fireEvent.click(await screen.findByRole('button', {name: /Nieuwe organisatie/}));
    fireEvent.change(screen.getByLabelText('Naam'), {target: {value: 'Korfbal Club Één'}});
    expect(screen.getByLabelText('Slug')).toHaveValue('korfbal-club-een');
    await screen.findByRole('option', {name: 'Fortuna/Ruitenheer'});
    fireEvent.change(screen.getByLabelText('Club'), {target: {value: '7'}});
    fireEvent.click(screen.getByRole('button', {name: 'Aanmaken'}));

    expect(await screen.findByText(/Organisatie aangemaakt, met de standaardset/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({name: 'Korfbal Club Één', slug: 'korfbal-club-een', clubId: 7});
    // The logo can be added right away
    expect(screen.getByText('Logo uploaden')).toBeInTheDocument();
  });

  it('refuses a slug the API wouldn\'t accept', async () => {
    const {calls} = api();
    renderPage(<OrganizationsAdminPage/>);
    fireEvent.click(await screen.findByRole('button', {name: /Nieuwe organisatie/}));
    fireEvent.change(screen.getByLabelText('Naam'), {target: {value: 'X'}});
    fireEvent.change(screen.getByLabelText('Slug'), {target: {value: 'met spatie'}});
    fireEvent.click(screen.getByRole('button', {name: 'Aanmaken'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('kleine letters');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('deactivates after a confirm', async () => {
    const {calls} = api();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage(<OrganizationsAdminPage/>);
    fireEvent.click(await screen.findByRole('button', {name: 'KNKV deactiveren'}));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')).toMatchObject({path: '/api/organizations/2', body: {isActive: false}}));
  });

  it('keeps the last active organization active', async () => {
    api([FORTUNA, OLD]);
    renderPage(<OrganizationsAdminPage/>);
    expect(await screen.findByRole('button', {name: 'Fortuna deactiveren'})).toBeDisabled();
  });

  it('keeps the current organization chosen when its slug is renamed: the new slug goes out right after the PUT', async () => {
    chooseOrganization(FORTUNA.slug);
    let fortuna: Organization = FORTUNA;
    const {calls} = mockApi(({method, path, body}) => {
      if (method === 'PUT' && path === `/api/organizations/${FORTUNA.id}`) return (fortuna = {...fortuna, ...(body as Partial<Organization>)});
      if (path === '/api/organizations' || path === '/api/organizations?all=true') return [fortuna, KNKV];
      return [];
    });
    installOrganizationFetch(window);
    renderPage(<OrganizationGate><OrganizationsAdminPage/></OrganizationGate>);
    fireEvent.click(await screen.findByRole('button', {name: 'Fortuna wijzigen'}));
    fireEvent.change(screen.getByLabelText('Slug'), {target: {value: 'fortuna-nieuw'}});
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.path.startsWith('/api/organizations')).length).toBeGreaterThan(2));
    const afterPut = calls.slice(calls.findIndex((c) => c.method === 'PUT') + 1);
    expect(afterPut.length).toBeGreaterThan(0);
    expect(afterPut.map((c) => c.headers.get('X-Organization'))).toEqual(afterPut.map(() => 'fortuna-nieuw'));
    expect(getOrganizationSlug()).toBe('fortuna-nieuw');
    expect(window.localStorage.getItem('organization')).toBe('fortuna-nieuw');
    expect(screen.queryByRole('heading', {name: 'Kies een organisatie'})).not.toBeInTheDocument();
    expect(await screen.findByText('fortuna-nieuw')).toBeInTheDocument();
  });

  it('leaves the choice alone when another organization is renamed', async () => {
    chooseOrganization(FORTUNA.slug);
    let knkv: Organization = KNKV;
    mockApi(({method, path, body}) => {
      if (method === 'PUT' && path === `/api/organizations/${KNKV.id}`) return (knkv = {...knkv, ...(body as Partial<Organization>)});
      if (path === '/api/organizations' || path === '/api/organizations?all=true') return [FORTUNA, knkv];
      return [];
    });
    installOrganizationFetch(window);
    renderPage(<OrganizationGate><OrganizationsAdminPage/></OrganizationGate>);
    fireEvent.click(await screen.findByRole('button', {name: 'KNKV wijzigen'}));
    fireEvent.change(screen.getByLabelText('Slug'), {target: {value: 'knkv-nieuw'}});
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    expect(await screen.findByText('knkv-nieuw')).toBeInTheDocument();
    expect(getOrganizationSlug()).toBe('fortuna');
  });

  it('suggests a slug from the name', () => {
    expect(suggestSlug('Fortuna/Ruitenheer')).toBe('fortuna-ruitenheer');
    expect(suggestSlug('  KNKV  ')).toBe('knkv');
  });
});
