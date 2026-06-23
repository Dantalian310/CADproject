create table project_invitations (
    id bigserial primary key,
    project_id bigint not null references projects(id) on delete cascade,
    inviter_id bigint not null references users(id) on delete cascade,
    invitee_id bigint not null references users(id) on delete cascade,
    role varchar(32) not null,
    status varchar(32) not null default 'PENDING',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    responded_at timestamptz,
    constraint ck_project_invitations_role check (role in ('EDITOR', 'VIEWER')),
    constraint ck_project_invitations_status check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED'))
);

create index idx_project_invitations_project_id on project_invitations(project_id);
create index idx_project_invitations_invitee_id on project_invitations(invitee_id);
create index idx_project_invitations_status on project_invitations(status);
