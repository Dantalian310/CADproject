create table users (
    id bigserial primary key,
    username varchar(64) not null,
    email varchar(128) not null,
    password_hash varchar(255) not null,
    display_name varchar(64),
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uk_users_username unique (username),
    constraint uk_users_email unique (email)
);

create table projects (
    id bigserial primary key,
    name varchar(128) not null,
    description text,
    owner_id bigint not null references users(id),
    deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table project_members (
    id bigserial primary key,
    project_id bigint not null references projects(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    role varchar(32) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uk_project_members_project_user unique (project_id, user_id),
    constraint ck_project_members_role check (role in ('OWNER', 'EDITOR', 'VIEWER'))
);

create table documents (
    id bigserial primary key,
    project_id bigint not null references projects(id) on delete cascade,
    name varchar(128) not null,
    current_version_id bigint,
    current_version_number integer not null default 0,
    snapshot_json jsonb,
    created_by bigint not null references users(id),
    updated_by bigint references users(id),
    deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_documents_current_version_number check (current_version_number >= 0)
);

create table document_versions (
    id bigserial primary key,
    document_id bigint not null references documents(id) on delete cascade,
    version_number integer not null,
    snapshot_json jsonb,
    snapshot_path varchar(512),
    created_by bigint not null references users(id),
    message varchar(255),
    created_at timestamptz not null default now(),
    constraint uk_document_versions_doc_version unique (document_id, version_number),
    constraint ck_document_versions_number check (version_number >= 1),
    constraint ck_document_versions_snapshot check (snapshot_json is not null or snapshot_path is not null)
);

alter table documents
    add constraint fk_documents_current_version
    foreign key (current_version_id) references document_versions(id) on delete set null;

create table operation_logs (
    id bigserial primary key,
    operation_id varchar(64) not null,
    document_id bigint not null references documents(id) on delete cascade,
    user_id bigint not null references users(id),
    operation_type varchar(64) not null,
    target_id varchar(128),
    base_version integer,
    server_version integer,
    operation_payload jsonb not null,
    created_at timestamptz not null default now()
);

create table system_events (
    id bigserial primary key,
    trace_id varchar(64),
    user_id bigint references users(id),
    project_id bigint references projects(id) on delete set null,
    document_id bigint references documents(id) on delete set null,
    event_type varchar(64) not null,
    event_payload jsonb,
    result varchar(32) not null,
    created_at timestamptz not null default now(),
    constraint ck_system_events_result check (result in ('SUCCESS', 'FAILED', 'DENIED', 'WARNING'))
);

create index idx_project_members_user_id on project_members(user_id);
create index idx_project_members_project_id on project_members(project_id);
create index idx_documents_project_id on documents(project_id);
create index idx_documents_current_version_id on documents(current_version_id);
create index idx_documents_snapshot_json_gin on documents using gin (snapshot_json);
create index idx_document_versions_document_id on document_versions(document_id);
create index idx_operation_logs_document_id on operation_logs(document_id);
create index idx_operation_logs_target_id on operation_logs(target_id);
create index idx_system_events_document_id on system_events(document_id);
